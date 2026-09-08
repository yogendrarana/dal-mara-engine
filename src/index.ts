// Engine API (replaces Game class)
export {
	createGame,
	dispatch,
	deal,
	declareTurup,
	pickupTurupCard,
	playCard,
	getLegalMoves,
	getCurrentPlayer,
	isFinished,
	type ActionResult,
	type CreateGameOptions,
} from "./core/engine";

// types and constants
export * from "./types/index";
export * from "./core/const";

// DMN
export { parseDMN, serializeDMN } from "./core/dmn";

// card utilities
export {
	createCard,
	compareCardRanks,
	parseCard,
	getCardSuit,
	getCardRank,
} from "./core/card";

// deck
export { createDeck, shuffleDeck } from "./core/deck";

// errors
export { DalMaraError, createValidationError } from "./core/errors";

// legal moves (internal API, also accessible directly)
export {
	getLegalMoves4P,
	getLegalMoves2P,
} from "./core/legal-moves";

// actions (validate, reduce, dispatch)
export {
	dispatchAction,
	validateAction,
	type DispatchResult,
	validateDeal,
	reduceDeal4P,
	reduceDeal2P,
	validateDeclareTurup,
	reduceDeclareTurup2P,
	validatePickupTurup,
	reducePickupTurup2P,
	validatePlayGhopte,
	reducePlayGhopte4P,
	validatePlayCard,
	reducePlayCard4P,
	reducePlayCard2P,
} from "./core/actions";

// serializers
export { serializeState, deserializeState, deserialize } from "./core/serializers";

// validators
export { validateCreateGame } from "./core/validators";

// scoring
export {
	createInitialScoreState,
	countTensInCards,
	updateScoreOnTrickWon,
} from "./core/scoring/scoring";

export {
	evaluateGameWinner4P,
	isGameFinished4P,
} from "./core/scoring/four-player";

export {
	evaluateGameWinner2P,
	isGameFinished2P,
} from "./core/scoring/two-player";

// rules
export { detectGhopte } from "./core/rules/four-player";
