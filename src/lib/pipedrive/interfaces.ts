export type NewPipedriveEntity = { properties?: Record<string, string> | undefined };
export type ExistingPipedriveEntity = NewPipedriveEntity & { id?: string };
export type FullPipedriveEntity = ExistingPipedriveEntity & { associations?: RelativeAssociation[] };

export type RelativeAssociation = `${string}:${string}`;

export type HubspotProperties = Record<string, string | null>;

export type Association = {
  fromId: string;
  toId: string;
  toType: string;
};

export type PipedriveEntityKind = 'deal' | 'person' | 'organization';

export enum Pipeline {
  MPAC,
}

export enum DealStage {
  EVAL,
  CLOSED_WON,
  CLOSED_LOST,
}

export interface PipedriveEntityAdapter<D> {
  kind: PipedriveEntityKind;

  associations: Partial<Record<PipedriveEntityKind, 'down' | 'down/up'>>;

  shouldReject?: (data: HubspotProperties) => boolean;

  data: {
    [K in keyof D]: {
      property: string | undefined;
      down: (data: string | null) => D[K];
      up: (data: D[K]) => string;
      makeComparable?: (v: D[K]) => string;
      identifier?: true;
    };
  };

  additionalProperties: string[];

  managedFields: Set<string>;
}
