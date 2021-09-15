import { DealStage } from "../../util/config.js";
import { DealRelevantEvent } from "./events.js";

const hosting = {
  isServer: (hosting: License['hosting']) => hosting === 'Server',
  isDataCenter: (hosting: License['hosting']) => hosting === 'Data Center',
  isCloud: (hosting: License['hosting']) => hosting === 'Cloud',
  isAny: (_hosting: License['hosting']) => true,
};

const event = {
  isNewTrial: (type: DealRelevantEvent['type']) => type === 'eval',
  isPurchase: (type: DealRelevantEvent['type']) => type === 'purchase',
  isaRenewal: (type: DealRelevantEvent['type']) => type === 'renewal',
  isUpgraded: (type: DealRelevantEvent['type']) => type === 'upgrade',
  isRefunded: (type: DealRelevantEvent['type']) => type === 'refund',
};

const state = {
  hasNothing: (deals: Deal[]) => deals.length === 0,
  hasTrial: (deals: Deal[]) => deals.some(d => d.properties.dealstage === DealStage.EVAL),
  any: (_deals: Deal[]) => true,
};

const outcome: { [name: string]: Outcome } = {
  createTrial: { type: 'create', stage: DealStage.EVAL },
  update: { type: 'update' },
  createWon: { type: 'create', stage: DealStage.CLOSED_WON },
  closeWon: { type: 'close', stage: DealStage.CLOSED_WON },
  closeLost: { type: 'close', stage: DealStage.CLOSED_LOST },
};

export const decisionMatrix: DecisionMatrix = [
  [hosting.isServer, event.isNewTrial, state.hasNothing, outcome.createTrial],
  [hosting.isServer, event.isNewTrial, state.hasTrial, outcome.update],
  [hosting.isServer, event.isPurchase, state.hasNothing, outcome.createWon],
  [hosting.isServer, event.isPurchase, state.hasTrial, outcome.closeWon],
  [hosting.isServer, event.isaRenewal, state.any, outcome.createWon],
  [hosting.isServer, event.isUpgraded, state.any, outcome.createWon],

  [hosting.isDataCenter, event.isNewTrial, state.hasNothing, outcome.createTrial],
  [hosting.isDataCenter, event.isNewTrial, state.hasTrial, outcome.update],
  [hosting.isDataCenter, event.isPurchase, state.hasNothing, outcome.createWon],
  [hosting.isDataCenter, event.isPurchase, state.hasTrial, outcome.closeWon],
  [hosting.isDataCenter, event.isaRenewal, state.any, outcome.createWon],
  [hosting.isDataCenter, event.isUpgraded, state.any, outcome.createWon],

  [hosting.isCloud, event.isNewTrial, state.hasNothing, outcome.createTrial],
  [hosting.isCloud, event.isPurchase, state.hasTrial, outcome.closeWon],
  [hosting.isCloud, event.isPurchase, state.hasNothing, outcome.createWon],
  [hosting.isCloud, event.isaRenewal, state.any, outcome.createWon],
  [hosting.isCloud, event.isUpgraded, state.any, outcome.createWon],

  [hosting.isAny, event.isRefunded, state.any, outcome.closeLost],
];

type Outcome = (
  { type: 'create', stage: DealStage } |
  { type: 'close', stage: DealStage } |
  { type: 'update' }
);

type DecisionMatrix = [
  (hosting: License['hosting']) => boolean,
  (type: DealRelevantEvent['type']) => boolean,
  (deals: Deal[]) => boolean,
  Outcome,
][];
