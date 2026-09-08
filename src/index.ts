export { Game, type CreateGameOptions } from "./core/game";

// types and constants
export * from "./types/index";
export * from "./core/const";

// apis
export { createDeck, shuffleDeck } from "./core/deck";

export {
	createCard,
	compareCardRanks,
	parseCard,
	getCardSuit,
	getCardRank,
} from "./core/card";

export { DalMaraError, createValidationError } from "./core/errors";

// core
export {
	getLegalMoves,
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

export { serializeState, deserializeState, deserialize } from "./core/serializers";

export {
	exportToDMN,
	importFromDMN,
	fromDMN,
	toDMN,
	cardToDMN,
	dmnToCard,
	type DMNState,
} from "./core/dmn";

export { validateCreateGame } from "./core/validators";
