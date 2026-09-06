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

export { gameReducer4P } from "./core/reducers/four-player";
export { gameReducer2P } from "./core/reducers/two-player";

export { exportReplay, playReplay, type ReplayData } from "./core/replay";
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

export {
	validateAction,
	validateCreateGame,
} from "./core/validators";
