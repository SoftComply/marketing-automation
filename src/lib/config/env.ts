import dotenv from 'dotenv';
import { DataShiftConfig } from '../data-shift/analyze';
import { EngineConfig } from '../engine/engine';
import { HubspotCreds } from '../hubspot/api';
import { MultiMpacCreds } from '../marketplace/api/api';
import { MpacConfig } from '../marketplace/marketplace';
import { HubspotContactConfig, PipedriveContactConfig } from '../model/contact';
import { HubspotDealConfig, PipedriveDealConfig } from '../model/deal';
import { RunLoopConfig } from '../util/runner';

dotenv.config();

export function keepDataSetConfigFromENV() {
  return optional('KEEP_DATA_SETS');
}

export function hubspotCredsFromENV(): HubspotCreds {
  return {
    accessToken: required('HUBSPOT_ACCESS_TOKEN'),
  };
}

export function pipedriveCredsFromENV() {
  return {
    apiKey: required('PIPEDRIVE_API_KEY'),
  };
}

export function hubspotSettingsFromENV() {
  const typeMappings = optional('HUBSPOT_ASSOCIATION_TYPE_MAPPINGS');
  return typeMappings ? new Map(typeMappings.split(',').map((kv) => kv.split(':') as [string, string])) : undefined;
}

export function pipedriveSettingsFromENV() {
  const typeMappings = optional('PIPEDRIVE_ASSOCIATION_TYPE_MAPPINGS');
  return typeMappings ? new Map(typeMappings.split(',').map((kv) => kv.split(':') as [string, string])) : undefined;
}

export function crmProviderFromEnv() {
  return required('CRM_PROVIDER');
}

export function mpacCredsFromENV(): MultiMpacCreds {
  return {
    user: required('MPAC_USER'),
    apiKey: required('MPAC_API_KEY'),
    sellerIds: required('MPAC_SELLER_ID').split(','),
  };
}

export function dataShiftConfigFromENV(): DataShiftConfig | undefined {
  const threshold = optional('LATE_TRANSACTION_THRESHOLD_DAYS');
  if (!threshold) return undefined;
  return {
    lateTransactionThresholdDays: +threshold,
  };
}

export function slackConfigFromENV() {
  return {
    apiToken: optional('SLACK_API_TOKEN'),
    errorChannelId: optional('SLACK_ERROR_CHANNEL_ID'),
  };
}

export function runLoopConfigFromENV(): RunLoopConfig {
  return {
    runInterval: required('RUN_INTERVAL'),
    retryInterval: required('RETRY_INTERVAL'),
    retryTimes: +required('RETRY_TIMES'),
  };
}

export function hubspotDealConfigFromENV(): HubspotDealConfig {
  return {
    accountId: optional('HUBSPOT_ACCOUNT_ID'),
    pipeline: {
      mpac: required('HUBSPOT_PIPELINE_MPAC'),
    },
    dealstage: {
      eval: required('HUBSPOT_DEALSTAGE_EVAL'),
      closedWon: required('HUBSPOT_DEALSTAGE_CLOSED_WON'),
      closedLost: required('HUBSPOT_DEALSTAGE_CLOSED_LOST'),
    },
    attrs: {
      app: optional('HUBSPOT_DEAL_APP_ATTR'),
      origin: optional('HUBSPOT_DEAL_ORIGIN_ATTR'),
      country: optional('HUBSPOT_DEAL_COUNTRY_ATTR'),
      deployment: optional('HUBSPOT_DEAL_DEPLOYMENT_ATTR'),
      saleType: optional('HUBSPOT_DEAL_SALE_TYPE_ATTR'),
      appEntitlementId: required('HUBSPOT_DEAL_APPENTITLEMENTID_ATTR'),
      appEntitlementNumber: required('HUBSPOT_DEAL_APPENTITLEMENTNUMBER_ATTR'),
      addonLicenseId: required('HUBSPOT_DEAL_ADDONLICENESID_ATTR'),
      transactionId: required('HUBSPOT_DEAL_TRANSACTIONID_ATTR'),
      licenseTier: optional('HUBSPOT_DEAL_LICENSE_TIER_ATTR'),
      relatedProducts: optional('HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR'),
      associatedPartner: optional('HUBSPOT_DEAL_ASSOCIATED_PARTNER'),
      duplicateOf: optional('HUBSPOT_DEAL_DUPLICATEOF_ATTR'),
      maintenanceEndDate: optional('HUBSPOT_DEAL_MAINTENANCE_END_DATE_ATTR'),
    },
    managedFields: new Set(optional('HUBSPOT_MANAGED_DEAL_FIELDS')?.split(/\s*,\s*/g) ?? []),
  };
}

export function pipedriveDealConfigFromENV(): PipedriveDealConfig {
  return {
    accountId: optional('PIPEDRIVE_ACCOUNT_ID'),
    pipeline: {
      mpac: required('PIPEDRIVE_PIPELINE_MPAC'),
    },
    dealstage: {
      eval: required('PIPEDRIVE_DEALSTAGE_EVAL'),
      closedWon: required('PIPEDRIVE_DEALSTAGE_CLOSED_WON'),
      closedLost: required('PIPEDRIVE_DEALSTAGE_CLOSED_LOST'),
    },
    attrs: {
      app: required('PIPEDRIVE_DEAL_APP_ATTR'),
      deployment: required('PIPEDRIVE_DEAL_DEPLOYMENT_ATTR'),
      appEntitlementId: required('PIPEDRIVE_DEAL_APPENTITLEMENTID_ATTR'),
      appEntitlementNumber: required('PIPEDRIVE_DEAL_APPENTITLEMENTNUMBER_ATTR'),
      addonLicenseId: required('PIPEDRIVE_DEAL_ADDONLICENESID_ATTR'),
      transactionId: required('PIPEDRIVE_DEAL_TRANSACTIONID_ATTR'),
      maintenanceEndDate: required('PIPEDRIVE_DEAL_MAINTENANCE_END_DATE_ATTR'),
      closeDate: required('PIPEDRIVE_DEAL_CLOSE_DATE_ATTR'),
      licenseTier: required('PIPEDRIVE_DEAL_LICENSE_TIER_ATTR'),
      licenseType: required('PIPEDRIVE_DEAL_LICENSE_TYPE_ATTR'),
      cloudSiteHostname: optional('PIPEDRIVE_DEAL_CLOUD_SITE_ATTR'),
      country: optional('PIPEDRIVE_DEAL_COUNTRY_ATTR'),
      changeInTier: optional('PIPEDRIVE_DEAL_CHANGE_IN_TIER_ATTR'),
      oldTier: optional('PIPEDRIVE_DEAL_OLD_TIER_ATTR'),
      billingPeriod: optional('PIPEDRIVE_DEAL_BILLING_PERIOD_ATTR'),
      saleType: optional('PIPEDRIVE_DEAL_SALE_TYPE_ATTR'),
      company: optional('PIPEDRIVE_DEAL_COMPANY_ATTR'),
      // relatedProducts: optional('HUBSPOT_DEAL_RELATED_PRODUCTS_ATTR'),
      // origin: optional('HUBSPOT_DEAL_ORIGIN_ATTR'),
      // associatedPartner: optional('HUBSPOT_DEAL_ASSOCIATED_PARTNER'),
      // duplicateOf: optional('HUBSPOT_DEAL_DUPLICATEOF_ATTR'),
    },
    // managedFields: new Set(optional('HUBSPOT_MANAGED_DEAL_FIELDS')?.split(/\s*,\s*/g) ?? []),
  };
}

export function pipedrivePipelineFromEnv() {
  return required('PIPEDRIVE_PIPELINE_MPAC');
}

export function closedWonStageFromEnv() {
  return required('PIPEDRIVE_DEALSTAGE_CLOSED_WON');
}

export function closedLostStageFromEnv() {
  return required('PIPEDRIVE_DEALSTAGE_CLOSED_LOST');
}

export function appEntitlementIdFromEnv() {
  return required('PIPEDRIVE_DEAL_APPENTITLEMENTID_ATTR');
}

export function appEntitlementNumberFromEnv() {
  return required('PIPEDRIVE_DEAL_APPENTITLEMENTNUMBER_ATTR');
}

export function addonLicenseIdFromEnv() {
  return required('PIPEDRIVE_DEAL_ADDONLICENESID_ATTR');
}

export function transactionIdFromEnv() {
  return required('PIPEDRIVE_DEAL_TRANSACTIONID_ATTR');
}

export function maintenanceEndDateFromEnv() {
  return required('PIPEDRIVE_DEAL_MAINTENANCE_END_DATE_ATTR');
}

export const hubspotAccountIdFromEnv = optional('HUBSPOT_ACCOUNT_ID');

export const pipedriveDomainFromEnv = required('PIPEDRIVE_DOMAIN');

export function hubspotContactConfigFromENV(): HubspotContactConfig {
  return {
    attrs: {
      deployment: optional('HUBSPOT_CONTACT_DEPLOYMENT_ATTR'),
      licenseTier: optional('HUBSPOT_CONTACT_LICENSE_TIER_ATTR'),
      products: optional('HUBSPOT_CONTACT_PRODUCTS_ATTR'),
      lastMpacEvent: optional('HUBSPOT_CONTACT_LAST_MPAC_EVENT_ATTR'),
      contactType: optional('HUBSPOT_CONTACT_CONTACT_TYPE_ATTR'),
      region: optional('HUBSPOT_CONTACT_REGION_ATTR'),
      relatedProducts: optional('HUBSPOT_CONTACT_RELATED_PRODUCTS_ATTR'),
      lastAssociatedPartner: optional('HUBSPOT_CONTACT_LAST_ASSOCIATED_PARTNER'),
    },
    managedFields: new Set(optional('HUBSPOT_MANAGED_CONTACT_FIELDS')?.split(/\s*,\s*/g) ?? []),
  };
}

export function pipedriveContactConfigFromENV(): PipedriveContactConfig {
  return {
    attrs: {
      deployment: optional('PIPEDRIVE_CONTACT_DEPLOYMENT_ATTR'),
      licenseTier: optional('PIPEDRIVE_CONTACT_LICENSE_TIER_ATTR'),
      products: optional('PIPEDRIVE_CONTACT_PRODUCTS_ATTR'),
      lastMpacEvent: optional('PIPEDRIVE_CONTACT_LAST_MPAC_EVENT_ATTR'),
      contactType: optional('PIPEDRIVE_CONTACT_CONTACT_TYPE_ATTR'),
      region: optional('PIPEDRIVE_CONTACT_REGION_ATTR'),
      relatedProducts: optional('PIPEDRIVE_CONTACT_RELATED_PRODUCTS_ATTR'),
      lastAssociatedPartner: optional('PIPEDRIVE_CONTACT_LAST_ASSOCIATED_PARTNER'),
      country: optional('PIPEDRIVE_CONTACT_COUNTRY_ATTR'),
    },
    managedFields: new Set(optional('PIPEDRIVE_MANAGED_CONTACT_FIELDS')?.split(/\s*,\s*/g) ?? []),
  };
}

export function mpacConfigFromENV(): MpacConfig {
  return {
    ignoredEmails: new Set((optional('IGNORED_EMAILS')?.split(',') ?? []).map((e) => e.toLowerCase())),
  };
}

export function engineConfigFromENV(): EngineConfig {
  return {
    partnerDomains: new Set(optional('PARTNER_DOMAINS')?.split(/\s*,\s*/g) ?? []),
    appToPlatform: Object.fromEntries<string>(
      required('ADDONKEY_PLATFORMS')
        .split(',')
        .map((kv) => kv.split('=') as [string, string])
    ),
    archivedApps: new Set(optional('IGNORED_APPS')?.split(',') ?? []),
    dealProperties: {
      dealOrigin: optional('DEAL_ORIGIN'),
      dealRelatedProducts: optional('DEAL_RELATED_PRODUCTS'),
      dealDealName: required('DEAL_DEALNAME'),
    },
  };
}

function required(key: string) {
  const value = process.env[key];
  if (!value) {
    console.error(`ENV key ${key} is required`);
    process.exit(1);
  }
  return value;
}

function optional(key: string) {
  return process.env[key];
}
