import { Contact } from './contact';
import { PipedriveEntityAdapter } from '../pipedrive/interfaces';
import { PipedriveEntity } from '../pipedrive/pipedriveEntity';
import { PipedriveEntityManager } from '../pipedrive/pipedrive-manager';

export type CompanyData = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends PipedriveEntity<CompanyData> {
  public contacts = this.makeDynamicAssociation<Contact>('person');
}

export const CompanyAdapter: PipedriveEntityAdapter<CompanyData> = {
  kind: 'organization',

  associations: {},

  data: {
    name: {
      property: 'name',
      down: (name) => name ?? '',
      up: (name) => name,
    },
    type: {
      property: 'type',
      down: (type) => (type === 'PARTNER' ? 'Partner' : null),
      up: (type) => (type === 'Partner' ? 'PARTNER' : ''),
    },
  },

  additionalProperties: [],

  managedFields: new Set(),
};

export class CompanyManager extends PipedriveEntityManager<CompanyData, Company> {
  protected override Entity = Company;
  public override entityAdapter = CompanyAdapter;
}
