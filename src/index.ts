export { Game } from "./engine/game";
export { Engine } from "./engine/engine";

// types and constants
export * from "./types/index";
export * from "./core/const";

// apis
export { createDeck, shuffleDeck } from "./core/deck";

export {
	createCard,
	compareCardRanks,
	parseCardId,
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

export { exportReplay, playReplay, type ReplayData } from "./engine/replay";
export { serializeState, deserializeState } from "./engine/serializers";

export {
	exportToDMN,
	importFromDMN,
	cardToDMN,
	dmnToCard,
	type DMNState,
} from "./engine/dmn";

export {
	validateAction,
	validateCreateGame,
} from "./core/validators";
