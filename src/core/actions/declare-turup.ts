import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES } from "../const";
import { getCurrentTurnPlayer } from "../turn";
import type { DeclareTurupAction, GameState, ValidationResult } from "../../types/index";

// Validation

export function validateDeclareTurup({ state, action }: { state: GameState; action: DeclareTurupAction }): ValidationResult {
	const currentTurnPlayer = getCurrentTurnPlayer(state);

	if (state.game.mode !== GAME_MODES.TWO_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Turup declaration action is only valid in 2-Player mode");
	}

	if (state.game.turup !== null) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_TURUP_DECLARATION, "Turup has already been declared");
	}

	const hasDealt = Object.values(state.hands).some((h) => h.length > 0);
	if (!hasDealt) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Cannot declare Turup before cards are dealt");
	}

	const hasDealtStacks = Object.values(state.stacks).some((pStacks) =>
		pStacks.some((s) => s.faceUpCard !== null || s.hiddenCards.length > 0),
	);
	if (hasDealtStacks) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Cannot declare Turup after stacks are dealt");
	}

	if (currentTurnPlayer?.seat !== action.payload.seat) {
		return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, "It is not your turn to declare Turup");
	}

	return { success: true };
}

// Reducer (2-Player only)

export function reduceDeclareTurup2P(state: GameState, action: DeclareTurupAction): GameState {
	if (state.game.turup !== null) return state;

	const turupSuit = action.payload.suit;
	const dealerSeat = state.game.dealerSeat;

	return {
		...state,
		game: {
			...state.game,
			turup: turupSuit,
		},
		trick: {
			number: 1,
			playNumber: 0,
			leadSuit: null,
			isGhopte: false,
			cards: [],
		},
		nextMoveSeat: dealerSeat,
	};
}
