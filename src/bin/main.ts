import 'source-map-support/register';
import { dataShiftConfigFromENV, engineConfigFromENV, runLoopConfigFromENV } from '../lib/config/env';
import { DataShiftAnalyzer } from '../lib/data-shift/analyze';
import { loadDataSets } from '../lib/data-shift/loader';
import { DataShiftReporter } from '../lib/data-shift/reporter';
import { dataManager } from '../lib/data/manager';
import { downloadAllData, downloadAllPipedriveData } from '../lib/engine/download';
import { Engine } from '../lib/engine/engine';
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { hubspotConfigFromENV } from '../lib/hubspot/hubspot';
import { ConsoleLogger } from '../lib/log/console';
import run from '../lib/util/runner';
import { pipedriveConfigFromENV } from '../lib/pipedrive/pipedrive';
import { PipedriveUploader } from '../lib/pipedrive/uploader';

const console = new ConsoleLogger();
// const uploader = new HubspotUploader(console);
const pipedriveUploader = new PipedriveUploader(console);

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(console);
void notifier?.notifyStarting();

run(console, runLoopConfig, {
  async work() {
    console.printInfo('Main', 'Pruning data sets');
    dataManager.pruneDataSets(console);

    console.printInfo('Main', 'Downloading data');
    // const ms = await downloadAllData(console, hubspotConfigFromENV());
    const ms = await downloadAllPipedriveData(console, pipedriveConfigFromENV());
    const dataSet = dataManager.dataSetFrom(ms);
    const logDir = dataSet.makeLogDir!('main');

    console.printInfo('Main', 'Running engine');
    const engine = new Engine(engineConfigFromENV(), console, logDir);
    engine.run(dataSet);

    console.printInfo('Main', 'Upsyncing changes to CRM');
    // await uploader.upsyncChangesToHubspot(dataSet.hubspot);
    await pipedriveUploader.upsyncChangesToPipedrive(dataSet.pipedrive);

    console.printInfo('Main', 'Writing change log file');
    logDir.hubspotOutputLogger()?.logResults(dataSet.pipedrive);

    console.printInfo('Main', 'Analyzing data shift');
    const dataSets = loadDataSets(console);
    const analyzer = new DataShiftAnalyzer(dataShiftConfigFromENV(), console);
    const results = analyzer.run(dataSets);
    const reporter = new DataShiftReporter(console, notifier);
    reporter.report(results);

    console.printInfo('Main', 'Done');
  },

  async failed(errors) {
    await notifier?.notifyErrors(runLoopConfig, errors);
  },
});
