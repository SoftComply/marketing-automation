import { hubspotContactConfigFromENV, hubspotDealConfigFromENV, hubspotSettingsFromENV } from '../config/env';
import { RawHubspotDataSet } from '../data/raw';
import { ConsoleLogger } from '../log/console';
import { CompanyManager } from '../model/company';
import { ContactManager, HubspotContactConfig } from '../model/contact';
import { DealManager, HubspotDealConfig } from '../model/deal';
import { Entity } from './entity';

export type HubspotConfig = {
  deal?: HubspotDealConfig;
  contact?: HubspotContactConfig;
  typeMappings?: Map<string, string>;
};

export class Hubspot {
  public dealManager;
  public personManager;
  public organizationManager;

  public constructor(config?: HubspotConfig) {
    const typeMappings = config?.typeMappings ?? new Map();

    this.dealManager = new DealManager(typeMappings, config?.deal ?? {});
    this.personManager = new ContactManager(typeMappings, config?.contact ?? {});
    this.organizationManager = new CompanyManager(typeMappings);
  }

  public importData(data: RawHubspotDataSet, console?: ConsoleLogger) {
    console?.printInfo('Hubspot', 'Importing entities...');
    const dealPrelinks = this.dealManager.importEntities(data.rawDeals);
    const companyPrelinks = this.organizationManager.importEntities(data.rawCompanies);
    const contactPrelinks = this.personManager.importEntities(data.rawContacts);
    console?.printInfo('Hubspot', 'Done.');

    console?.printInfo('Hubspot', 'Linking entities...');
    this.dealManager.linkEntities(dealPrelinks, this);
    this.organizationManager.linkEntities(companyPrelinks, this);
    this.personManager.linkEntities(contactPrelinks, this);
    console?.printInfo('Hubspot', 'Done.');
  }

  public populateFakeIds() {
    // fillInIds(this.dealManager.getAll());
    // fillInIds(this.personManager.getAll());
    // fillInIds(this.organizationManager.getAll());

    function fillInIds(entities: Iterable<Entity<any>>) {
      let id = 0;
      for (const e of entities) {
        if (!e.id) e.id = `fake-${e.kind}-${++id}`;
      }
    }
  }
}

export function hubspotConfigFromENV(): HubspotConfig {
  return {
    contact: hubspotContactConfigFromENV(),
    deal: hubspotDealConfigFromENV(),
    typeMappings: hubspotSettingsFromENV(),
  };
}
