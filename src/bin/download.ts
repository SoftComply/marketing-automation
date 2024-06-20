import 'source-map-support/register';
import { downloadAllData, downloadAllPipedriveData } from '../lib/engine/download';
import { ConsoleLogger } from '../lib/log/console';
import { pipedriveConfigFromENV } from '../lib/pipedrive/pipedrive';
import { hubspotConfigFromENV } from '../lib/hubspot/hubspot';

const console = new ConsoleLogger();
// void downloadAllData(console, hubspotConfigFromENV());
void downloadAllPipedriveData(console, pipedriveConfigFromENV());
