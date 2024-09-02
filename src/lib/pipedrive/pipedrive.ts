import {
  addonLicenseIdFromEnv,
  appEntitlementIdFromEnv,
  appEntitlementNumberFromEnv,
  closedLostStageFromEnv,
  closedWonStageFromEnv,
  maintenanceEndDateFromEnv,
  pipedriveContactConfigFromENV,
  pipedriveCredsFromENV,
  pipedriveDealConfigFromENV,
  pipedrivePipelineFromEnv,
  pipedriveSettingsFromENV,
  transactionIdFromEnv,
} from '../config/env';
import { RawPipedriveDataSet } from '../data/raw';
import { ConsoleLogger } from '../log/console';
import { CompanyManager } from '../model/company';
import { ContactManager, PipedriveContactConfig } from '../model/contact';
import { DealManager, PipedriveDealConfig } from '../model/deal';
import {
  Configuration,
  DealsApi,
  DealsApiAddDealRequest,
  NewDealParametersStatusConst,
  OrganizationsApi,
  OrganizationsApiAddOrganizationRequest,
  OrganizationsApiUpdateOrganizationRequest,
  PersonsApi,
  PersonsApiAddPersonRequest,
  PersonsApiUpdatePersonRequest,
  PipelinesApi,
} from 'pipedrive';
import { PipedriveEntity } from './pipedriveEntity';
import { Association, ExistingPipedriveEntity, NewPipedriveEntity } from './interfaces';
import { DealsApiUpdateDealRequest } from 'pipedrive/api/deals-api';

export type PipedriveConfig = {
  deal?: PipedriveDealConfig;
  contact?: PipedriveContactConfig;
  typeMappings?: Map<string, string>;
};

export class Pipedrive {
  public dealManager;
  public personManager;
  public organizationManager;

  public constructor(config?: PipedriveConfig) {
    const typeMappings = config?.typeMappings ?? new Map();
    this.dealManager = new DealManager(typeMappings, config?.deal ?? {});
    this.personManager = new ContactManager(typeMappings, config?.contact ?? {});
    this.organizationManager = new CompanyManager(typeMappings);
  }

  public importData(data: RawPipedriveDataSet, console?: ConsoleLogger) {
    console?.printInfo('Pipedrive', 'Importing entities...');
    const dealPrelinks = this.dealManager.importEntities(data.rawDeals);
    const companyPrelinks = this.organizationManager.importEntities(data.rawCompanies);
    const contactPrelinks = this.personManager.importEntities(data.rawContacts);
    console?.printInfo('Pipedrive', 'Done.');

    console?.printInfo('Pipedrive', 'Linking entities...');
    this.dealManager.linkEntities(dealPrelinks, this);
    this.organizationManager.linkEntities(companyPrelinks, this);
    this.personManager.linkEntities(contactPrelinks, this);
    console?.printInfo('Pipedrive', 'Done.');
  }

  public populateFakeIds() {
    fillInIds(this.dealManager.getAll());
    fillInIds(this.personManager.getAll());
    fillInIds(this.organizationManager.getAll());

    function fillInIds(entities: Iterable<PipedriveEntity<any>>) {
      let id = 0;
      for (const e of entities) {
        if (!e.id) e.id = `fake-${e.kind}-${++id}`;
      }
    }
  }
}

export class PipelineApi extends PipelinesApi {
  public async getAllPipelineDeals() {
    const id = +pipedrivePipelineFromEnv();
    const limit = 500;
    let start = 0;
    const data = [];
    let moreItemsInCollection = false;

    do {
      const response = await this.getPipelineDeals({ id, limit, start });
      if (response.success) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (response.data) data.push(...response.data);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        moreItemsInCollection = !!response.additional_data?.['pagination']['more_items_in_collection'];
        start += limit;
      } else {
        moreItemsInCollection = false;
      }
    } while (moreItemsInCollection);

    return data;
  }
}
const pipedriveConfiguration = new Configuration(pipedriveCredsFromENV());

export class PipeDriveDealsApi extends DealsApi {
  public async getAll() {
    const pipelineApi = new PipelineApi(pipedriveConfiguration);
    return pipelineApi.getAllPipelineDeals();
  }

  public async createEntity(data: NewPipedriveEntity) {
    const stageId = parseInt(data.properties?.['stage_id'] || '0', 10);
    let status: NewDealParametersStatusConst = NewDealParametersStatusConst.open;

    switch (data.properties?.['dealstage']) {
      case closedWonStageFromEnv():
        status = NewDealParametersStatusConst.won;
        break;
      case closedLostStageFromEnv():
        status = NewDealParametersStatusConst.lost;
        break;
    }
    const createEntityRequest: DealsApiAddDealRequest = {
      AddDealRequest: {
        title: data.properties?.['title'] || 'Deal name missing',
        value: data.properties?.['amount'],
        stage_id: stageId,
        // expected_close_date: data.properties?.['closedate'],
        status,
      },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createEntityRequest.AddDealRequest[appEntitlementIdFromEnv()] = data.properties?.[appEntitlementIdFromEnv()];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createEntityRequest.AddDealRequest[maintenanceEndDateFromEnv()] = data.properties?.[maintenanceEndDateFromEnv()];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createEntityRequest.AddDealRequest[appEntitlementNumberFromEnv()] =
      data.properties?.[appEntitlementNumberFromEnv()];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createEntityRequest.AddDealRequest[addonLicenseIdFromEnv()] = data.properties?.[addonLicenseIdFromEnv()];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createEntityRequest.AddDealRequest[transactionIdFromEnv()] = data.properties?.[transactionIdFromEnv()];
    try {
      const result = await this.addDeal(createEntityRequest);

      if (!result.success) {
        console.log('Creating of entity failed');
        console.log('Data: ', data);
        console.log('Create request: ', createEntityRequest);
        console.log('Result: ', result);
      }

      return result;
    } catch (e) {
      console.log('%c ---> Error: ', 'color:#F00;', e);
      return null;
    }
  }

  public async update(data: ExistingPipedriveEntity) {
    const id = data.id ? +data.id : 0;
    const updateEntityRequest: DealsApiUpdateDealRequest = {
      id,
      UpdateDealRequest: {
        ...data.properties,
      },
    };
    return this.updateDeal(updateEntityRequest);
  }

  public async associate(data: Association) {
    const associateEntityRequest = {
      id: +data.fromId,
      UpdateDealRequest: {},
    };
    if (data.toType === 'person') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      associateEntityRequest.UpdateDealRequest['person_id'] = +data.toId;
    } else if (data.toType === 'organization') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      associateEntityRequest.UpdateDealRequest['org_id'] = +data.toId;
    }
    return this.updateDeal(associateEntityRequest);
  }
}

export class PipeDrivePersonsApi extends PersonsApi {
  public async getAll() {
    const limit = 500;
    let start = 0;
    const data = [];
    let moreItemsInCollection = false;

    do {
      const response = await this.getPersons({ limit, start });
      if (response.success) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (response.data) data.push(...response.data);
        moreItemsInCollection = !!response.additional_data?.pagination?.more_items_in_collection;
        start += limit;
      } else {
        moreItemsInCollection = false;
      }
    } while (moreItemsInCollection);

    return data;
  }

  public createEntity = async (data: NewPipedriveEntity) => {
    const name = `${data.properties?.['first_name']} ${data.properties?.['last_name']}` || 'Person name missing';
    const createEntityRequest: PersonsApiAddPersonRequest = {
      AddPersonRequest: {
        name,
        email: [{ value: data.properties?.['primary_email'], primary: true }],
      },
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createEntityRequest.AddPersonRequest['postal_address_country'] = data.properties?.['country'];
    return this.addPerson(createEntityRequest);
  };

  public async update(data: ExistingPipedriveEntity) {
    const id = data.id ? +data.id : 0;
    const updateEntityRequest: PersonsApiUpdatePersonRequest = {
      id,
      UpdatePersonRequest: {},
    };
    for (const key in data.properties) {
      const pipedriveKey = key === 'phone.0.value' ? 'phone' : key;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      updateEntityRequest.UpdatePersonRequest[pipedriveKey] = data.properties?.[key];
    }
    console.log('%c ---> Update person data: ', 'color:#0F0;', updateEntityRequest);
    return this.updatePerson(updateEntityRequest);
  }

  public async associate(data: Association) {
    console.log('%c ---> Associate deal data: ', 'color:#0F0;', data);
    const id = data.fromId ? +data.fromId : 0;
    const associateEntityRequest: PersonsApiUpdatePersonRequest = {
      id,
      UpdatePersonRequest: {
        org_id: +data.toId,
      },
    };
    return this.updatePerson(associateEntityRequest);
  }
}

export class PipeDriveOrganizationsApi extends OrganizationsApi {
  public async getAll() {
    const limit = 500;
    let start = 0;
    const data = [];
    let moreItemsInCollection = false;

    do {
      const response = await this.getOrganizations({ limit, start });
      if (response.success) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (response.data) data.push(...response.data);
        moreItemsInCollection = !!response.additional_data?.pagination?.more_items_in_collection;
        start += limit;
      } else {
        moreItemsInCollection = false;
      }
    } while (moreItemsInCollection);
    return data;
  }

  public async createEntity(data: NewPipedriveEntity) {
    console.log('%c ---> Organization data: ', 'color:#0F0;', data);
    const createEntityRequest: OrganizationsApiAddOrganizationRequest = {
      AddOrganizationRequest: {
        name: data.properties?.['name'] || 'Organization name missing',
      },
    };
    return this.addOrganization(createEntityRequest);
  }

  public async update(data: ExistingPipedriveEntity) {
    console.log('%c ---> Update organization data: ', 'color:#0F0;', data);
    const id = data.id ? +data.id : 0;
    const updateEntityRequest: OrganizationsApiUpdateOrganizationRequest = {
      id,
      UpdateOrganizationRequest: {
        ...data.properties,
      },
    };
    return this.updateOrganization(updateEntityRequest);
  }

  public async associate(data: Association) {
    return;
  }
}

export function pipedriveConfigFromENV(): PipedriveConfig {
  return {
    contact: pipedriveContactConfigFromENV(),
    deal: pipedriveDealConfigFromENV(),
    typeMappings: pipedriveSettingsFromENV(),
  };
}
