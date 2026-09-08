import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES } from "../const";
import { getCurrentTurnPlayer } from "../turn";
import type { DeclareTurupAction, GameState, PlayerPosition, ValidationResult } from "../../types/index";

// Validation

export function validateDeclareTurup({ state, action }: { state: GameState; action: DeclareTurupAction }): ValidationResult {
	const currentTurnPlayer = getCurrentTurnPlayer(state);

	if (state.game.mode !== GAME_MODES.TWO_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Turup declaration action is only valid in 2-Player mode");
	}

	if (state.game.phase !== GAME_PHASES.TURUP_DECLARATION) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot declare Turup outside TURUP_DECLARATION phase");
	}

	if (currentTurnPlayer?.position !== action.payload.playerPosition) {
		return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, "It is not your turn to declare Turup");
	}

	return { success: true };
}

// Reducer (2-Player only)

export function reduceDeclareTurup2P(state: GameState, action: DeclareTurupAction): GameState {
	if (state.game.phase !== GAME_PHASES.TURUP_DECLARATION) return state;

	const turupSuit = action.payload.suit;
	const dealerPosition = state.game.dealerPosition;
	const nonDealerPosition = ((dealerPosition + 1) % 2) as PlayerPosition;

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
		nextMovePlayerPosition: nonDealerPosition,
	};
}
