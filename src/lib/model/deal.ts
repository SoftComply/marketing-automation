import { hubspotAccountIdFromEnv } from '../config/env';
import { AttachableError } from '../util/errors';
import { isPresent } from '../util/helpers';
import { Company } from './company';
import { Contact } from './contact';
import { uniqueTransactionId } from './transaction';
import { DealStage, Pipeline } from '../hubspot/interfaces';
import { PipedriveEntityAdapter } from '../pipedrive/interfaces';
import { PipedriveEntity } from '../pipedrive/pipedriveEntity';
import { PipedriveEntityManager } from '../pipedrive/pipedrive-manager';

export type DealData = {
  relatedProducts: string | null;
  app: string | null;
  addonLicenseId: string | null;
  transactionId: string | null;
  closeDate: string | null;
  country: string | null;
  dealName: string;
  company: string | null;
  origin: string | null;
  deployment: 'Server' | 'Cloud' | 'Data Center' | null;
  saleType: 'New' | 'Renewal' | 'Upgrade' | string;
  licenseTier: number | null;
  pipeline: Pipeline;
  licenseType: string | null;
  dealStage: DealStage;
  value: number | null;
  associatedPartner: string | null;
  cloudSiteHostname: string | null;

  appEntitlementId: string | null;
  appEntitlementNumber: string | null;

  duplicateOf: string | null;
  maintenanceEndDate: string | null;
  changeInTier: string | null;
  oldTier: number | null;
  billingPeriod: string | null;
};

export class Deal extends PipedriveEntity<DealData> {
  public contacts = this.makeDynamicAssociation<Contact>('person');
  public companies = this.makeDynamicAssociation<Company>('organization');

  public getMpacIds() {
    return new Set(
      [
        this.deriveId(this.data.addonLicenseId),
        this.deriveId(this.data.appEntitlementId),
        this.deriveId(this.data.appEntitlementNumber),
      ].filter(isPresent)
    );
  }

  private deriveId(id: string | null) {
    if (!id) return null;
    if (!this.data.transactionId) return id;
    return uniqueTransactionId(this.data.transactionId, id);
  }

  public get isWon() {
    return this.data.dealStage === DealStage.CLOSED_WON;
  }
  public get isLost() {
    return this.data.dealStage === DealStage.CLOSED_LOST;
  }

  public isEval() {
    return this.data.dealStage === DealStage.EVAL;
  }
  public isClosed() {
    return this.isWon || this.isLost;
  }

  public link() {
    const hsAccountId = hubspotAccountIdFromEnv;
    return hsAccountId
      ? `https://app.hubspot.com/contacts/${hsAccountId}/deal/${this.id}/`
      : `Deal=${this.id} (see link by setting HUBSPOT_ACCOUNT_ID)`;
  }

  hasActivity() {
    return (
      isNonBlankString(this.downloadedData['hs_user_ids_of_all_owners']) ||
      isNonBlankString(this.downloadedData['engagements_last_meeting_booked']) ||
      isNonBlankString(this.downloadedData['hs_latest_meeting_activity']) ||
      isNonBlankString(this.downloadedData['notes_last_contacted']) ||
      isNonBlankString(this.downloadedData['notes_last_updated']) ||
      isNonBlankString(this.downloadedData['notes_next_activity_date']) ||
      isNonBlankString(this.downloadedData['hs_sales_email_last_replied']) ||
      isNonZeroNumberString(this.downloadedData['num_contacted_notes']) ||
      isNonZeroNumberString(this.downloadedData['num_notes'])
    );
  }
}

export interface HubspotDealConfig {
  accountId?: string;
  pipeline?: {
    mpac?: string;
  };
  dealstage?: {
    eval?: string;
    closedWon?: string;
    closedLost?: string;
  };
  attrs?: {
    appEntitlementId?: string;
    appEntitlementNumber?: string;
    addonLicenseId?: string;
    transactionId?: string;
    app?: string;
    origin?: string;
    country?: string;
    deployment?: string;
    saleType?: string;
    licenseTier?: string;
    relatedProducts?: string;
    associatedPartner?: string;
    duplicateOf?: string;
    maintenanceEndDate?: string;
  };
  managedFields?: Set<string>;
}

export interface HubspotRequiredDealConfig {
  pipeline: {
    mpac: string;
  };
  dealstage: {
    eval: string;
    closedWon: string;
    closedLost: string;
  };
  attrs: {
    appEntitlementId: string;
    appEntitlementNumber: string;
    addonLicenseId: string;
    transactionId: string;
  };
}

export interface PipedriveDealConfig {
  accountId?: string;
  pipeline?: {
    mpac?: string;
  };
  dealstage?: {
    eval?: string;
    closedWon?: string;
    closedLost?: string;
  };
  attrs?: {
    appEntitlementId?: string;
    appEntitlementNumber?: string;
    addonLicenseId?: string;
    transactionId?: string;
    app?: string;
    origin?: string;
    country?: string;
    deployment?: string;
    saleType?: string;
    licenseTier?: string;
    licenseType?: string;
    relatedProducts?: string;
    associatedPartner?: string;
    duplicateOf?: string;
    maintenanceEndDate?: string;
    closeDate?: string;
    cloudSiteHostname?: string;
    changeInTier?: string;
    oldTier?: string;
    billingPeriod?: string;
    company?: string;
  };
  managedFields?: Set<string>;
}

export interface PipedriveRequiredDealConfig {
  pipeline: {
    mpac: string;
  };
  dealstage: {
    eval: string;
    closedWon: string;
    closedLost: string;
  };
  attrs: {
    app: string;
    deployment: string;
    appEntitlementId: string;
    appEntitlementNumber: string;
    addonLicenseId: string;
    transactionId: string;
    maintenanceEndDate: string;
    closeDate: string;
    licenseTier: string;
    licenseType: string;
  };
}

function isNonBlankString(str: string | null) {
  return (str ?? '').length > 0;
}

function isNonZeroNumberString(str: string | null) {
  return +(str ?? '') > 0;
}

function makeAdapter(config: PipedriveDealConfig): PipedriveEntityAdapter<DealData> {
  const requiredConfig: PipedriveRequiredDealConfig = {
    pipeline: {
      mpac: config.pipeline?.mpac ?? 'Pipeline',
    },
    dealstage: {
      eval: config.dealstage?.eval ?? 'Eval',
      closedWon: config.dealstage?.closedWon ?? 'ClosedWon',
      closedLost: config.dealstage?.closedLost ?? 'ClosedLost',
    },
    attrs: {
      app: config.attrs?.app ?? 'app',
      deployment: config.attrs?.deployment ?? 'deployment',
      appEntitlementId: config.attrs?.appEntitlementId ?? 'appEntitlementId',
      appEntitlementNumber: config.attrs?.appEntitlementNumber ?? 'appEntitlementNumber',
      addonLicenseId: config.attrs?.addonLicenseId ?? 'addonLicenseId',
      transactionId: config.attrs?.transactionId ?? 'transactionId',
      maintenanceEndDate: config.attrs?.maintenanceEndDate ?? 'maintenanceEndDate',
      closeDate: config.attrs?.closeDate ?? 'closeDate',
      licenseTier: config.attrs?.licenseTier ?? 'licenseTier',
      licenseType: config.attrs?.licenseType ?? 'licenseType',
    },
  };

  function enumFromValue<T extends number>(mapping: Record<T, string>, apiValue: string): T {
    const found = Object.entries(mapping).find(([k, v]) => v === apiValue.toString());
    if (!found)
      throw new AttachableError('Cannot find ENV-configured mapping:', JSON.stringify({ mapping, apiValue }, null, 2));
    return +found[0] as T;
  }

  const pipelines: Record<Pipeline, string> = {
    [Pipeline.MPAC]: requiredConfig.pipeline.mpac,
  };

  const dealstages: Record<DealStage, string> = {
    [DealStage.EVAL]: requiredConfig.dealstage.eval,
    [DealStage.CLOSED_WON]: requiredConfig.dealstage.closedWon,
    [DealStage.CLOSED_LOST]: requiredConfig.dealstage.closedLost,
  };

  return {
    kind: 'deal',

    associations: {
      organization: 'down/up',
      person: 'down/up',
    },

    shouldReject(data) {
      if (data['pipeline_id']?.toString() !== requiredConfig.pipeline.mpac) return true;
      return !!(config.attrs?.duplicateOf && data[config.attrs?.duplicateOf]);
    },

    data: {
      relatedProducts: {
        property: config.attrs?.relatedProducts,
        down: (related_products) => related_products || null,
        up: (relatedProducts) => relatedProducts ?? '',
      },
      app: {
        property: config.attrs?.app,
        down: (app) => app,
        up: (app) => app ?? '',
      },
      addonLicenseId: {
        property: requiredConfig.attrs.addonLicenseId,
        identifier: true,
        down: (id) => id || null,
        up: (id) => id || '',
      },
      transactionId: {
        property: requiredConfig.attrs.transactionId,
        identifier: true,
        down: (id) => id || null,
        up: (id) => id || '',
      },
      closeDate: {
        property: requiredConfig.attrs.closeDate,
        down: (closedate) => closedate,
        up: (closeDate) => closeDate ?? '',
      },
      country: {
        property: config.attrs?.country,
        down: (country) => country,
        up: (country) => country ?? '',
      },
      dealName: {
        property: 'title',
        down: (dealname) => dealname!,
        up: (dealName) => dealName,
      },
      origin: {
        property: config.attrs?.origin,
        down: (origin) => origin,
        up: (origin) => origin ?? '',
      },
      deployment: {
        property: config.attrs?.deployment,
        down: (deployment) => deployment as DealData['deployment'],
        up: (deployment) => deployment ?? '',
      },
      cloudSiteHostname: {
        property: config.attrs?.cloudSiteHostname,
        down: (cloudSiteHostname) => cloudSiteHostname || null,
        up: (cloudSiteHostname) => cloudSiteHostname ?? '',
      },
      saleType: {
        property: config.attrs?.saleType,
        down: (sale_type) => sale_type as DealData['saleType'],
        up: (saleType) => saleType ?? '',
      },
      licenseTier: {
        property: config.attrs?.licenseTier,
        down: (license_tier) => (license_tier ? +license_tier : null),
        up: (licenseTier) => licenseTier?.toFixed() ?? '',
      },
      licenseType: {
        property: config.attrs?.licenseType,
        down: (license_type) => license_type,
        up: (licenseType) => licenseType ?? '',
      },
      pipeline: {
        property: 'pipeline_id',
        down: (data) => Pipeline.MPAC,
        up: (pipeline) => pipelines[pipeline],
      },
      dealStage: {
        property: 'stage_id',
        down: (dealstage) => enumFromValue(dealstages, dealstage ?? ''),
        up: (dealstage) => dealstages[dealstage],
      },
      value: {
        property: 'value',
        down: (amount) => (!amount ? null : +amount),
        up: (amount) => amount?.toString() ?? '0',
      },
      associatedPartner: {
        property: config.attrs?.associatedPartner,
        down: (partner) => partner || null,
        up: (partner) => partner ?? '',
      },
      appEntitlementId: {
        property: requiredConfig.attrs.appEntitlementId,
        identifier: true,
        down: (id) => id || null,
        up: (id) => id ?? '',
      },
      appEntitlementNumber: {
        property: requiredConfig.attrs.appEntitlementNumber,
        identifier: true,
        down: (id) => id || null,
        up: (id) => id ?? '',
      },
      duplicateOf: {
        property: config.attrs?.duplicateOf,
        down: (id) => id || null,
        up: (id) => id ?? '',
      },
      maintenanceEndDate: {
        property: config.attrs?.maintenanceEndDate,
        down: (maintenanceEnd) => (maintenanceEnd ? maintenanceEnd.substring(0, 10) : null),
        up: (maintenanceEnd) => maintenanceEnd ?? '',
      },
      changeInTier: {
        property: config.attrs?.changeInTier,
        down: (changeInTier) => changeInTier || null,
        up: (changeInTier) => changeInTier ?? '',
      },
      oldTier: {
        property: config.attrs?.oldTier,
        down: (oldTier) => (oldTier ? +oldTier : null),
        up: (oldTier) => oldTier?.toFixed() ?? '',
      },
      billingPeriod: {
        property: config.attrs?.billingPeriod,
        down: (billingPeriod) => billingPeriod || null,
        up: (billingPeriod) => billingPeriod ?? '',
      },
      company: {
        property: config.attrs?.company,
        down: (company) => company || '',
        up: (company) => company ?? '',
      },
    },

    additionalProperties: [],

    managedFields: config.managedFields ?? new Set(),
  };
}

export class DealManager extends PipedriveEntityManager<DealData, Deal> {
  protected override Entity = Deal;
  public override entityAdapter: PipedriveEntityAdapter<DealData>;

  public duplicates = new Map<Deal, Deal[]>();
  constructor(typeMappings: Map<string, string>, config: PipedriveDealConfig) {
    super(typeMappings);
    this.entityAdapter = makeAdapter(config);
  }
}
