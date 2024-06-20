import { pipedriveCredsFromENV } from '../config/env';
import { ConsoleLogger } from '../log/console';
import { KnownError } from '../util/errors';
import { Configuration } from 'pipedrive';
import {
  Association,
  ExistingPipedriveEntity,
  NewPipedriveEntity,
  PipedriveEntityAdapter,
  PipedriveEntityKind,
  RelativeAssociation,
} from './interfaces';
import { BaseAPI } from 'pipedrive/dist/base';
import { PipeDriveDealsApi, PipeDriveOrganizationsApi, PipeDrivePersonsApi } from './pipedrive';

export type PipedriveCreds = {
  accessToken: string;
};

const pipedriveConfiguration = new Configuration(pipedriveCredsFromENV());

export default class PipedriveAPI {
  private client: BaseAPI;

  constructor(private console?: ConsoleLogger) {
    this.client = new BaseAPI(pipedriveConfiguration);
  }

  public async downloadPipedriveEntities<D>(entityAdapter: PipedriveEntityAdapter<D>) {
    const entityKind = entityAdapter.kind;
    console.log(`Downloading ${entityKind}s...`);
    const inputAssociations = Object.entries(entityAdapter.associations)
      .filter(([kind, dir]) => dir.includes('down'))
      .map(([kind, dir]) => kind);
    try {
      const entities = await this.apiFor(entityKind).getAll();
      return (entities || []).map((e) => {
        const propertyKeys = Object.keys(e);
        const associations: RelativeAssociation[] = [];
        for (const associationKind of inputAssociations) {
          const isOrganizationKind = associationKind === 'organization';
          const key = isOrganizationKind ? 'org_id' : `${associationKind}_id`;
          const associationFromData = (e as any)[key];
          if (associationFromData) {
            const associationFromValue = entityKind === 'deal' ? associationFromData : associationFromData.value;
            associations.push(`${associationKind}:${associationFromValue}`);
          }
        }

        const properties = propertyKeys.reduce((acc: Record<string, string>, key: string) => {
          acc[key] = (e as any)[key];
          return acc;
        }, {});
        const id = e.id ? e.id.toString() : 'fake-id';

        return {
          id,
          properties,
          associations,
        };
      });
    } catch (e: any) {
      const body = e.response?.body;
      if (
        (typeof body === 'string' && (body === 'internal error' || body.startsWith('<!DOCTYPE html>'))) ||
        (typeof body === 'object' && body.status === 'error' && body.message === 'internal error')
      ) {
        throw new KnownError(`Pipedrive API for "${entityKind}" had internal error.`);
      } else {
        throw new Error(
          `Failed downloading ${entityKind}s.\n  Response body: ${JSON.stringify(body)}\n  Error stacktrace: ${e.stack}`
        );
      }
    }
  }

  public async createEntities(
    kind: PipedriveEntityKind,
    entities: NewPipedriveEntity[]
  ): Promise<ExistingPipedriveEntity[]> {
    if (kind === 'organization') console.log('Creating organizations', entities);
    const created: ExistingPipedriveEntity[] = [];
    const api = this.apiFor(kind);
    const numberOfEntities = entities.length;
    for (const [index, entity] of entities.entries()) {
      try {
        console.log(`Creating ${kind} entity ${index + 1} of ${numberOfEntities}`);
        await new Promise((resolve) => setTimeout(resolve, 5)); // 1000 ms = 1 second
        // if (kind === 'deal') {
        //   console.log('Creating deal', entity.properties);
        // }
        const response = await api.createEntity(entity);
        if (!response) {
          continue;
        }
        const { data } = response;
        if (data) {
          const propertyKeys = Object.keys(data);
          const properties = propertyKeys.reduce((acc: Record<string, string>, key: string) => {
            acc[key] = (data as any)[key];
            return acc;
          }, {});
          const id = data.id ? data.id.toString() : 'fake-id';

          created.push({
            id,
            properties,
          });
        }
      } catch (e: any) {
        this.console?.printError('Pipedrive API', 'Error creating entities ', { kind, entity });
        const errMsg = e.response?.body?.message || e;
        this.console?.printError('Pipedrive API', 'Error', errMsg ?? e);
      }
    }
    return created;
  }

  public async updateEntities(
    kind: PipedriveEntityKind,
    entities: ExistingPipedriveEntity[]
  ): Promise<ExistingPipedriveEntity[]> {
    const updated: ExistingPipedriveEntity[] = [];
    const numberOfEntities = entities.length;

    for (const [index, entity] of entities.entries()) {
      try {
        console.log(`Updating ${kind} entity ${index + 1} of ${numberOfEntities}`);
        await new Promise((resolve) => setTimeout(resolve, 5)); // 1000 ms = 1 second
        const { data, success } = await this.apiFor(kind).update(entity);
        if (data) {
          const propertyKeys = Object.keys(data);
          const properties = propertyKeys.reduce((acc: Record<string, string>, key: string) => {
            acc[key] = (data as any)[key];
            return acc;
          }, {});
          const id = data.id ? data.id.toString() : 'fake-id';

          updated.push({
            id,
            properties,
          });
        }
      } catch (e: any) {
        this.console?.printError('Pipedrive API', 'Error updating entities ', { kind, entity });
        const errMsg = e.response?.body?.message || e;
        this.console?.printError('Pipedrive API', 'Error', errMsg ?? e);
      }
    }
    return updated;
  }

  public async createAssociations(
    fromKind: PipedriveEntityKind,
    toKind: PipedriveEntityKind,
    inputs: Association[]
  ): Promise<void> {
    const api = this.apiFor(fromKind);
    console.log(`Creating ${inputs.length} associations from ${fromKind} to ${toKind}...`);
    for (const [index, input] of inputs.entries()) {
      console.log(
        `Creating association ${index + 1} of ${inputs.length} from ${fromKind}-${input.fromId} to ${toKind}-${input.toId}`
      );
      await new Promise((resolve) => setTimeout(resolve, 5)); // 1000 ms = 1 second
      await api.associate(input);
    }
  }

  public async deleteAssociations(
    fromKind: PipedriveEntityKind,
    toKind: PipedriveEntityKind,
    inputs: Association[]
  ): Promise<void> {
    console.log(`Deleting ${inputs.length} associations from ${fromKind} to ${toKind}...`);
    // for (const inputBatch of batchesOf(inputs, 100)) {
    //   await this.client.crm.associations.batchApi
    //     .archive(fromKind, toKind, {
    //       inputs: inputBatch.map((input) => mapAssociationInput(fromKind, input)),
    //     })
    //     .catch(({ response }) => {
    //       this.console?.printError('HubSpot API', 'Error deleting associations', {
    //         fromKind,
    //         toKind,
    //         inputBatch,
    //         hubspotResponse: response.body,
    //       });
    //     });
    // }
  }

  private apiFor(kind: PipedriveEntityKind) {
    switch (kind) {
      case 'deal':
        return (this.client = new PipeDriveDealsApi(pipedriveConfiguration));
      case 'organization':
        return (this.client = new PipeDriveOrganizationsApi(pipedriveConfiguration));
      case 'person':
        return (this.client = new PipeDrivePersonsApi(pipedriveConfiguration));
    }
  }
}

function mapAssociationInput(fromKind: PipedriveEntityKind, input: Association) {
  return {
    from: { id: input.fromId },
    to: { id: input.toId },
    type: `${fromKind}_to_${input.toType}`,
  };
}
