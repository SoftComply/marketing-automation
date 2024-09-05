import mustache from 'mustache';
import { DealPropertyConfig } from '../engine/engine';
import { DealStage, Pipeline } from '../hubspot/interfaces';
import { ConsoleLogger } from '../log/console';
import { Deal, DealData, DealManager } from '../model/deal';
import { License } from '../model/license';
import { Transaction, uniqueTransactionId } from '../model/transaction';
import { isPresent, sorter } from '../util/helpers';
import {
  abbrEventDetails,
  DealRelevantEvent,
  EvalEvent,
  EventMeta,
  PurchaseEvent,
  RefundEvent,
  RenewalEvent,
  UpgradeEvent,
} from './events';

type DealNoOpReason = Exclude<EventMeta, null> | 'properties-up-to-date';

export type Action = CreateDealAction | UpdateDealAction | IgnoreDealAction;
export type CreateDealAction = { type: 'create'; properties: DealData };
export type UpdateDealAction = { type: 'update'; deal: Deal; properties: Record<string, string> };
export type IgnoreDealAction = { type: 'noop'; deal: Deal | null; reason: DealNoOpReason };

export class ActionGenerator {
  #mpacIndex = new Map<string, Set<Deal>>();
  #handledDeals = new Map<Deal, DealRelevantEvent>();

  public constructor(
    private dealManager: DealManager,
    private dealPropertyConfig: DealPropertyConfig,
    private ignore: (reason: string, amount: number) => void,
    private console?: ConsoleLogger
  ) {
    for (const deal of this.dealManager.getAll()) {
      for (const id of deal.getMpacIds()) {
        let set = this.#mpacIndex.get(id);
        if (!set) this.#mpacIndex.set(id, (set = new Set()));
        set.add(deal);
      }
    }
  }

  public generateFrom(records: (License | Transaction)[], events: DealRelevantEvent[]) {
    return events.flatMap((event) => this.actionsFor(records, event));
  }

  private actionsFor(records: (License | Transaction)[], event: DealRelevantEvent): Action[] {
    switch (event.type) {
      case 'eval':
        return [this.actionForEval(records, event)];
      case 'purchase':
        return [this.actionForPurchase(records, event)];
      case 'renewal':
        return [this.actionForRenewal(records, event)];
      case 'upgrade':
        return [this.actionForRenewal(records, event)];
      case 'refund':
        return this.actionsForRefund(records, event);
    }
  }

  private actionForEval(records: (License | Transaction)[], event: EvalEvent): Action {
    // console.log(
    //   'Get action for event',
    //   event.type,
    //   ', License IDs:',
    //   event.licenses.map((license) => license.id)
    // );
    const deal = this.singleDeal(this.getDealsForRecords(event.licenses));
    // console.log('deal: ?????????????  ', deal);
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, 0);
    if (metaAction) return metaAction;

    const latestLicense = event.licenses[event.licenses.length - 1];
    if (!deal) {
      const dealStage = event.licenses.some((l) => l.active) ? DealStage.EVAL : DealStage.CLOSED_LOST;
      return this.makeCreateAction(records, latestLicense, dealStage);
    } else if (deal.isEval()) {
      const dealStage = latestLicense.active ? DealStage.EVAL : DealStage.CLOSED_LOST;
      return this.makeUpdateAction(records, deal, latestLicense, dealStage);
    } else {
      return this.makeUpdateAction(records, deal, latestLicense);
    }
  }

  private actionForPurchase(records: (License | Transaction)[], event: PurchaseEvent): Action {
    // console.log(
    //   'Get action for event',
    //   event.type,
    //   ', License IDs:',
    //   event.licenses.map((license) => license.id),
    //   ', Transaction ID:',
    //   event.transaction?.id
    // );
    const recordsToSearch = [event.transaction, ...event.licenses].filter(isPresent);
    const deal = this.singleDeal(this.getDealsForRecords(recordsToSearch));
    // console.log('deal: ?????????????  ', deal);
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, event.transaction?.data.vendorAmount ?? 0);
    if (metaAction) return metaAction;

    const record = event.transaction || getLatestLicense(event);
    if (deal && record instanceof License) {
      const dealStage = record.active ? DealStage.CLOSED_WON : DealStage.CLOSED_LOST;
      return this.makeUpdateAction(records, deal, record, dealStage);
    } else if (deal && record instanceof Transaction) {
      const dealStage = event.transaction?.refunded ? DealStage.CLOSED_LOST : DealStage.CLOSED_WON;
      return this.makeUpdateAction(records, deal, record, dealStage);
    } else if (event.transaction) {
      return this.makeCreateAction(records, event.transaction, DealStage.CLOSED_WON);
    } else {
      const license = getLatestLicense(event);
      return this.makeCreateAction(records, license, DealStage.CLOSED_WON);
    }
  }

  private actionForRenewal(records: (License | Transaction)[], event: RenewalEvent | UpgradeEvent): Action {
    // console.log('Get action for event', event.type, ', Transaction ID:', event.transaction.id);
    const deal = this.singleDeal(this.getDealsForRecords([event.transaction]));
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, event.transaction.data.vendorAmount);
    if (metaAction) return metaAction;

    if (deal) {
      return this.makeUpdateAction(records, deal, event.transaction);
    }
    return this.makeCreateAction(records, event.transaction, DealStage.CLOSED_WON);
  }

  private actionsForRefund(records: (License | Transaction)[], event: RefundEvent): Action[] {
    const deals = this.getDealsForRecords(event.refundedTxs);
    for (const deal of deals) {
      this.recordSeen(deal, event);
    }

    return [...deals]
      .map((deal) => this.makeUpdateAction(records, deal, null, DealStage.CLOSED_LOST, { value: 0 }))
      .filter(isPresent);
  }

  private recordSeen(deal: Deal, event: DealRelevantEvent) {
    if (this.#handledDeals.has(deal)) {
      const existing = this.#handledDeals.get(deal);
      this.console?.printError('Deal Generator', 'Updating deal twice', {
        firstEvent: existing && abbrEventDetails(existing),
        currentEvent: abbrEventDetails(event),
        deal: {
          id: deal.id,
          data: deal.data,
        },
      });
    } else {
      this.#handledDeals.set(deal, event);
    }
  }

  private getDealsForRecords(records: (License | Transaction)[]) {
    const ids = new Set<string | null>();

    for (const record of records) {
      if (record instanceof Transaction) {
        const txId = record.data.transactionId;
        ids.add(record.data.addonLicenseId && uniqueTransactionId(txId, record.data.addonLicenseId));
        ids.add(record.data.appEntitlementId && uniqueTransactionId(txId, record.data.appEntitlementId));
        ids.add(record.data.appEntitlementNumber && uniqueTransactionId(txId, record.data.appEntitlementNumber));
      } else {
        ids.add(record.data.addonLicenseId);
        ids.add(record.data.appEntitlementId);
        ids.add(record.data.appEntitlementNumber);
      }
    }

    // console.log('ids: ', ids);
    const deals = new Set<Deal>();
    for (const id of ids) {
      if (id) {
        // console.log('Looking for id: ', id);
        const set = this.#mpacIndex.get(id);
        if (set) {
          // console.log('Found set: ', set);
          for (const deal of set) {
            deals.add(deal);
          }
        }
      }
    }
    // console.log('dealssss: ', deals);
    return deals;
  }

  private singleDeal(foundDeals: Set<Deal>) {
    let dealToUse = null;

    if (foundDeals.size === 1) {
      [dealToUse] = foundDeals;
    } else if (foundDeals.size > 1) {
      // Has duplicates!

      const importantDeals = [...foundDeals].filter((d) => d.hasActivity());

      let toDelete: Deal[] = [];

      if (importantDeals.length === 0) {
        // Just pick one, it'll be updated soon; delete the rest
        [dealToUse, ...toDelete] = foundDeals;
        console.log(
          'Found duplicates, no important deals: ',
          dealToUse.id,
          toDelete.map((deal) => deal.id)
        );
      } else {
        // Pick one, keep/report the other importants; delete the rest
        dealToUse = importantDeals[0];

        if (importantDeals.length > 1) {
          this.console?.printWarning(
            'Deal Generator',
            `Found duplicates that can't be auto-deleted.`,
            importantDeals.map((d) => ({ id: d.id, ...d.data }))
          );
        }

        toDelete = [...foundDeals].filter((deal) => !importantDeals.includes(deal));
      }

      console.log(
        'Found duplicate deals. Pick single deal: ',
        dealToUse.id,
        ', deals to delete:',
        toDelete.map((deal) => deal.id)
      );

      if (this.dealManager.duplicates.has(dealToUse)) {
        throw new Error(`Primary duplicate is accounted for twice: ${dealToUse.id}`);
      }

      if (toDelete.length > 0) {
        this.dealManager.duplicates.set(dealToUse, toDelete);
      }

      for (const dup of toDelete) {
        dup.data.duplicateOf = dealToUse.id ?? null;
      }
    }

    return dealToUse;
  }

  maybeMakeMetaAction(
    event: Exclude<DealRelevantEvent, RefundEvent>,
    deal: Deal | null,
    amount: number
  ): Action | null {
    switch (event.meta) {
      case 'archived-app':
      case 'mass-provider-only': {
        const reason = event.meta === 'archived-app' ? 'Archived-app transaction' : 'Free-email-provider transaction';
        if (!deal) {
          this.ignore(reason, amount);
        }
        return { type: 'noop', deal, reason: event.meta };
      }
      default:
        return null;
    }
  }

  private makeCreateAction(
    records: (License | Transaction)[],
    record: License | Transaction,
    dealStage: DealStage
  ): Action {
    return {
      type: 'create',
      properties: this.dealCreationProperties(records, record, dealStage),
    };
  }

  private makeUpdateAction(
    records: (License | Transaction)[],
    deal: Deal,
    record: License | Transaction | null,
    dealStage?: DealStage,
    certainData?: Partial<DealData>
  ): Action {
    if (dealStage !== undefined) deal.data.dealStage = dealStage;
    if (record) {
      Object.assign(deal.data, this.dealCreationProperties(records, record, dealStage ?? deal.data.dealStage));
      deal.data.licenseTier = Math.max(deal.data.licenseTier ?? -1, record.tier);
    }

    if (certainData) {
      Object.assign(deal.data, certainData);
    }

    if (!deal.hasPropertyChanges()) {
      return { type: 'noop', deal, reason: 'properties-up-to-date' };
    }

    return {
      type: 'update',
      deal,
      properties: deal.getPropertyChanges(),
    };
  }

  private dealCreationProperties(
    records: (License | Transaction)[],
    record: License | Transaction,
    dealStage: DealStage
  ): DealData {
    /**
     * If any record in any of the deal's groups have partner contacts
     * then use the most recent record's partner contact's domain.
     * Otherwise set this to null.
     */
    const associatedPartner =
      [...records]
        .reverse()
        .map((record) => record.partnerDomain)
        .find((domain) => domain) ?? null;
    const addonName = record.data.addonName.replace('SoftComply ', '').split(' - ')[0];
    const deployment = record.data.hosting;

    return {
      closeDate: record instanceof Transaction ? record.data.saleDate : record.data.maintenanceStartDate,
      deployment,
      saleType: record instanceof Transaction && record.data.saleType !== 'Refund' ? record.data.saleType : '',
      app: addonName,
      company: record.data.company,
      changeInTier: record instanceof Transaction ? record.changeInTier : null,
      oldTier: record instanceof Transaction ? record.oldTier : null,
      billingPeriod: record instanceof Transaction ? record.data.billingPeriod : null,
      licenseTier: record.tier,
      licenseType: record.data.licenseType,
      country: record.data.country,
      origin: this.dealPropertyConfig.dealOrigin ?? null,
      relatedProducts: this.dealPropertyConfig.dealRelatedProducts ?? null,
      dealName: `${addonName} - ${record.data.company} - ${deployment}`,
      pipeline: Pipeline.MPAC,
      associatedPartner,
      addonLicenseId: record.data.addonLicenseId,
      transactionId: record instanceof Transaction ? record.data.transactionId : null,
      appEntitlementId: record.data.appEntitlementId,
      duplicateOf: null,
      maintenanceEndDate: record.data.maintenanceEndDate,
      appEntitlementNumber: record.data.appEntitlementNumber,
      dealStage,
      value: dealStage === DealStage.EVAL ? null : record instanceof License ? 0 : record.data.vendorAmount,
      cloudSiteHostname: record instanceof License ? record.data.cloudSiteHostname : null,
    };
  }
}

function getLatestLicense(event: PurchaseEvent): License {
  return [...event.licenses].sort(sorter((item) => item.data.maintenanceStartDate, 'DSC'))[0];
}
