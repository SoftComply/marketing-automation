import { DateTime } from 'luxon';
import { crmProviderFromEnv, mpacConfigFromENV } from '../config/env';
import { deriveMultiProviderDomainsSet } from '../engine/all-free-email-providers';
import { Hubspot, HubspotConfig, hubspotConfigFromENV } from '../hubspot/hubspot';
import { ConsoleLogger } from '../log/console';
import { LogDir } from '../log/logdir';
import { Marketplace, MpacConfig } from '../marketplace/marketplace';
import { RawHubspotDataSet, RawPipedriveDataSet } from './raw';
import { Pipedrive, PipedriveConfig, pipedriveConfigFromENV } from '../pipedrive/pipedrive';

export type DataSetConfig = {
  mpacConfig?: MpacConfig;
  hubspotConfig?: HubspotConfig;
  pipedriveConfig?: PipedriveConfig;
};

export class HubspotDataSet {
  public static fromDataSet(other: HubspotDataSet) {
    other.rawData.rawDeals = other.hubspot.dealManager.getArray().map((e) => e.toRawEntity());
    other.rawData.rawContacts = other.hubspot.personManager.getArray().map((e) => e.toRawEntity());
    other.rawData.rawCompanies = other.hubspot.organizationManager.getArray().map((e) => e.toRawEntity());

    const newDataSet = new HubspotDataSet(other.rawData, other.timestamp, other.config);
    newDataSet.makeLogDir = other.makeLogDir;
    return newDataSet;
  }

  public freeEmailDomains = new Set<string>();
  public hubspot;
  public mpac;

  public makeLogDir?: (name: string) => LogDir;

  public constructor(
    public rawData: RawHubspotDataSet,
    public timestamp: DateTime,
    private config?: DataSetConfig,
    console?: ConsoleLogger
  ) {
    this.hubspot = new Hubspot(config?.hubspotConfig);
    this.mpac = new Marketplace(config?.mpacConfig);

    this.freeEmailDomains = deriveMultiProviderDomainsSet(rawData.freeDomains);
    this.hubspot.importData(rawData, console);
    this.mpac.importData(rawData, console);
  }
}

export class PipedriveDataSet {
  public static fromDataSet(other: PipedriveDataSet) {
    other.rawData.rawDeals = other.pipedrive.dealManager.getArray().map((e) => e.toRawEntity());
    other.rawData.rawContacts = other.pipedrive.personManager.getArray().map((e) => e.toRawEntity());
    other.rawData.rawCompanies = other.pipedrive.organizationManager.getArray().map((e) => e.toRawEntity());

    const newDataSet = new PipedriveDataSet(other.rawData, other.timestamp, other.config);
    newDataSet.makeLogDir = other.makeLogDir;
    return newDataSet;
  }

  public freeEmailDomains = new Set<string>();
  public pipedrive;
  public mpac;

  public makeLogDir?: (name: string) => LogDir;

  public constructor(
    public rawData: RawPipedriveDataSet,
    public timestamp: DateTime,
    private config?: DataSetConfig,
    console?: ConsoleLogger
  ) {
    this.pipedrive = new Pipedrive(config?.pipedriveConfig);
    this.mpac = new Marketplace(config?.mpacConfig);

    this.freeEmailDomains = deriveMultiProviderDomainsSet(rawData.freeDomains);
    this.pipedrive.importData(rawData, console);
    this.mpac.importData(rawData, console);
  }
}

export function dataSetConfigFromENV(): DataSetConfig {
  const baseConfig = {
    mpacConfig: mpacConfigFromENV(),
  };

  if (crmProviderFromEnv() === 'hubspot') {
    return {
      ...baseConfig,
      hubspotConfig: hubspotConfigFromENV(),
    };
  } else {
    return {
      ...baseConfig,
      pipedriveConfig: pipedriveConfigFromENV(),
    };
  }
}
