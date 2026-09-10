import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES } from "../const";
import { getCurrentTurnPlayer } from "../turn";
import type { DeclareTurupAction, GameState, Seat, ValidationResult } from "../../types/index";

// Validation

export function validateDeclareTurup({ state, action }: { state: GameState; action: DeclareTurupAction }): ValidationResult {
	const currentTurnPlayer = getCurrentTurnPlayer(state);

	if (state.game.mode !== GAME_MODES.TWO_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Turup declaration action is only valid in 2-Player mode");
	}

	if (state.game.phase !== GAME_PHASES.TURUP_DECLARATION) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot declare Turup outside TURUP_DECLARATION phase");
	}

	if (currentTurnPlayer?.seat !== action.payload.seat) {
		return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, "It is not your turn to declare Turup");
	}

	return { success: true };
}

// Reducer (2-Player only)

export function reduceDeclareTurup2P(state: GameState, action: DeclareTurupAction): GameState {
	if (state.game.phase !== GAME_PHASES.TURUP_DECLARATION) return state;

	const turupSuit = action.payload.suit;
	const dealerSeat = state.game.dealerSeat;
	const nonDealerSeat = ((dealerSeat + 1) % 2) as Seat;

	return {
		...state,
		game: {
			...state.game,
			phase: GAME_PHASES.PLAYING,
			turup: turupSuit,
		},
		trick: {
			number: 1,
			playNumber: 0,
			leadSuit: null,
			isGhopte: false,
			cards: [],
		},
		nextMoveSeat: nonDealerSeat,
	};
}
