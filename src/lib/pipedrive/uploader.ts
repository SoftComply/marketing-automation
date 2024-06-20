import { ConsoleLogger } from '../log/console';
import PipedriveAPI from '../pipedrive/api';
import { Pipedrive } from '../pipedrive/pipedrive';
import { PipedriveEntityManager, typedEntries } from './pipedrive-manager';
import { PipedriveEntity } from './pipedriveEntity';
import { PipedriveEntityKind } from './interfaces';

export class PipedriveUploader {
  #console?: ConsoleLogger;
  pipedriveApi;
  constructor(console?: ConsoleLogger) {
    this.#console = console;
    this.pipedriveApi = new PipedriveAPI(console);
  }

  public async upsyncChangesToPipedrive(pipedrive: Pipedrive) {
    await this.syncUpAllEntitiesProperties(pipedrive.dealManager);
    await this.syncUpAllEntitiesProperties(pipedrive.personManager);
    await this.syncUpAllEntitiesProperties(pipedrive.organizationManager);

    await this.syncUpAllAssociations(pipedrive.dealManager);
    await this.syncUpAllAssociations(pipedrive.personManager);
    await this.syncUpAllAssociations(pipedrive.organizationManager);
  }

  private async syncUpAllEntitiesProperties<D extends Record<string, any>, E extends PipedriveEntity<D>>(
    manager: PipedriveEntityManager<D, E>
  ) {
    const entitiesWithChanges = manager.getArray().map((e) => ({ e, changes: e.getPropertyChanges() }));
    const toSync = entitiesWithChanges.filter(({ changes }) => Object.keys(changes).length > 0);

    const toCreate = toSync.filter(({ e }) => e.id === null);
    const toUpdate = toSync.filter(({ e }) => e.id !== null);

    if (toCreate.length > 0) {
      const created = await this.pipedriveApi.createEntities(
        manager.entityAdapter.kind,
        toCreate.map(({ changes }) => ({
          properties: changes as Record<string, string>,
        }))
      );

      const identifiers = typedEntries(manager.entityAdapter.data).filter(([k, v]) => v.identifier);

      for (const { e } of toCreate) {
        const found = created.find((result) => {
          for (const [localIdKey, spec] of identifiers) {
            const localVal = e.data[localIdKey];
            const hsLocal = spec.up(localVal);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const hsRemote = result.properties[spec.property!] ?? '';
            if (hsLocal !== hsRemote) return false;
          }
          return true;
        });

        if (!found) {
          this.#console?.printError(
            'Uploader',
            "Couldn't find",
            JSON.stringify(
              {
                local: e.data,
                remotes: created.map((r) => ({
                  id: r.id,
                  properties: r.properties,
                })),
              },
              null,
              2
            )
          );
        } else {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          e.id = found.id;
        }
      }
    }

    if (toUpdate.length > 0) {
      await this.pipedriveApi.updateEntities(
        manager.entityAdapter.kind,
        toUpdate.map(({ e, changes }) => ({
          id: e.guaranteedId(),
          properties: changes as Record<string, string>,
        }))
      );
    }
  }

  private async syncUpAllAssociations<D extends Record<string, any>, E extends PipedriveEntity<D>>(
    manager: PipedriveEntityManager<D, E>
  ) {
    const toSync = manager
      .getArray()
      .filter((e) => e.hasAssociationChanges())
      .flatMap((e) => e.getAssociationChanges().map(({ op, other }) => ({ op, from: e, to: other })));

    const upAssociations = Object.entries(manager.entityAdapter.associations)
      .filter(([kind, dir]) => dir.includes('up'))
      .map(([kind, dir]) => kind as PipedriveEntityKind);

    for (const otherKind of upAssociations) {
      const toSyncInKind = toSync
        .filter((changes) => changes.to.kind === otherKind)
        .filter((changes) => {
          if (!changes.from.id || !changes.to.id) {
            this.#console?.printError(
              'Uploader',
              `Will skip association of [${changes.to.kind}] between [${changes.from.id ?? 'unknown'}] and [${changes.to.id ?? 'unknown'}] due to missing Id`
            );
            return false;
          }
          return true;
        })
        .map((changes) => ({
          ...changes,
          inputs: {
            fromId: changes.from.guaranteedId(),
            toId: changes.to.guaranteedId(),
            toType: otherKind,
          },
        }));

      const toAdd = toSyncInKind.filter((changes) => changes.op === 'add');
      const toDel = toSyncInKind.filter((changes) => changes.op === 'del');

      await this.pipedriveApi.createAssociations(
        manager.entityAdapter.kind,
        otherKind,
        toAdd.map((changes) => changes.inputs)
      );

      await this.pipedriveApi.deleteAssociations(
        manager.entityAdapter.kind,
        otherKind,
        toDel.map((changes) => changes.inputs)
      );
    }
  }
}
