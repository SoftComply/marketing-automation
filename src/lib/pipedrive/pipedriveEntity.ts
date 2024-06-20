import { PipedriveEntityAdapter, PipedriveEntityKind, RelativeAssociation } from './interfaces';
import { FullEntity } from '../hubspot/interfaces';

export interface PipedriveIndexer<D extends Record<string, any>> {
  removeIndexesFor<K extends keyof D>(key: K, entity: PipedriveEntity<D>): void;
  addIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined, entity: PipedriveEntity<D>): void;
}

export abstract class PipedriveEntity<D extends Record<string, any>> {
  public id: string | null;

  private _oldData: D = Object.create(null);
  private newData: D = Object.create(null);

  private oldAssocs = new Set<PipedriveEntity<any>>();
  private newAssocs = new Set<PipedriveEntity<any>>();

  public readonly data: D;

  /** Don't call directly; use manager.create() */
  public constructor(
    id: string | null,
    public adapter: PipedriveEntityAdapter<D>,
    protected downloadedData: Record<string, string>,
    data: D,
    private indexer: PipedriveIndexer<D>
  ) {
    this.id = id;
    if (id) Object.assign(this._oldData, data);
    Object.assign(this.newData, data);

    type K = keyof D;
    this.data = new Proxy(this.newData, {
      set: (_target, _key, _val) => {
        const key = _key as K;
        const val = _val as D[K];
        if (!this._oldData[key] || !this.#isFieldManaged(key as string)) {
          this.indexer.removeIndexesFor(key, this);
          this.newData[key] = val;
          this.indexer.addIndexesFor(key, val, this);
        }
        return true;
      },
    });
  }

  #isFieldManaged(key: string): boolean {
    const hsFieldName = this.adapter.data[key].property;
    if (!hsFieldName) return false;
    return this.adapter.managedFields.has(hsFieldName);
  }

  get kind() {
    return this.adapter.kind;
  }

  public guaranteedId() {
    if (!this.id) throw new Error('Trying to access null deal id!');
    return this.id;
  }

  // Properties

  public hasPropertyChanges() {
    return Object.keys(this.getPropertyChanges()).length > 0;
  }

  public getPropertyChanges() {
    const upProperties: Partial<{ [K in keyof D]: string }> = Object.create(null);
    for (const [k, v] of Object.entries(this.newData)) {
      const spec = this.adapter.data[k];
      const oldValue = this._oldData[k];

      const compString1 = oldValue === undefined ? '' : spec.makeComparable?.(oldValue) ?? oldValue;
      const compString2 = spec.makeComparable?.(v) ?? v;

      if (compString1 !== compString2) {
        if (spec.property === 'value' && compString1 === null && compString2 === 0) {
          // This is a special case for the value property, which is a string in the API but a number in the data model.
          // The API treats 'null' and '0' as the same value, but we want to treat them as different.
          continue;
        }
        if (spec.property) {
          const upKey = spec.property as keyof D;
          // console.log(`'${spec.property}' property changed: '${compString1}' != '${compString2}'`);
          upProperties[upKey] = spec.up(v);
        }
      }
    }
    return upProperties;
  }

  // Associations

  protected makeDynamicAssociation<T extends PipedriveEntity<any>>(kind: PipedriveEntityKind) {
    return {
      getAll: () => this.getAssociations(kind) as T[],
      add: (entity: T) => this.addAssociation(entity, { firstSide: true, initial: false }),
      clear: () => this.clearAssociations(kind),
    };
  }

  /** Don't use directly; use deal.contacts.add(c) etc. */
  public addAssociation(entity: PipedriveEntity<any>, meta: { firstSide: boolean; initial: boolean }) {
    if (meta.initial) this.oldAssocs.add(entity);
    this.newAssocs.add(entity);

    if (meta.firstSide) entity.addAssociation(this, { firstSide: false, initial: meta.initial });
  }

  private getAssociations(kind: PipedriveEntityKind) {
    return [...this.newAssocs].filter((e) => e.adapter.kind === kind);
  }

  private clearAssociations(kind: PipedriveEntityKind) {
    for (const e of this.newAssocs) {
      if (e.adapter.kind === kind) {
        this.newAssocs.delete(e);
      }
    }
  }

  public hasAssociationChanges() {
    return (
      [...this.oldAssocs].some((e) => !this.newAssocs.has(e)) || [...this.newAssocs].some((e) => !this.oldAssocs.has(e))
    );
  }

  public getAssociationChanges() {
    const toAdd = [...this.newAssocs].filter((e) => !this.oldAssocs.has(e));
    const toDel = [...this.oldAssocs].filter((e) => !this.newAssocs.has(e));
    return [...toAdd.map((e) => ({ op: 'add', other: e })), ...toDel.map((e) => ({ op: 'del', other: e }))] as {
      op: 'add' | 'del';
      other: PipedriveEntity<any>;
    }[];
  }

  // Back transformation

  public toRawEntity(): FullEntity {
    return {
      id: this.id!,
      properties: this.upsyncableData(),
      associations: [...this.upsyncableAssociations()].map((other) => {
        return `${this.kind}_to_${other.kind}:${other.id}` as RelativeAssociation;
      }),
    };
  }

  private upsyncableData() {
    const upProperties: Record<string, string> = { ...this.downloadedData };
    for (const [k, v] of Object.entries(this.newData)) {
      const spec = this.adapter.data[k];
      if (spec.property) {
        const upKey = spec.property;
        const upVal = spec.up(v);
        upProperties[upKey] = upVal;
      }
    }
    return upProperties;
  }

  private upsyncableAssociations() {
    return [...this.newAssocs].filter((other) => {
      const found = this.adapter.associations[other.kind];
      return found?.includes('up');
    });
  }
}
