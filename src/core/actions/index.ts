import { ENGINE_ERROR_CODES } from "../const";
import { createValidationError } from "../errors";
import { ACTION_TYPES, GAME_MODES } from "../const";
import type { Action, GameState, ValidationResult } from "../../types/index";
import { validateDeal, reduceDeal4P, reduceDeal2P } from "./deal";
import { validatePlayGhopte, reducePlayGhopte4P } from "./play-ghopte";
import { validatePickupTurup, reducePickupTurup2P } from "./pickup-turup";
import { validateDeclareTurup, reduceDeclareTurup2P } from "./declare-turup";
import { validatePlayCard, reducePlayCard4P, reducePlayCard2P } from "./play-card";

export interface DispatchResult {
	state: GameState;
	validation: ValidationResult;
}

export function dispatchAction({
	state,
	action,
}: {
	state: GameState;
	action: Action;
}): DispatchResult {
	switch (action.type) {
		case ACTION_TYPES.DEAL: {
			const validation = validateDeal({ state, action });
			if (!validation.success) return { state, validation };

			const nextState = state.game.mode === GAME_MODES.FOUR_PLAYER ? reduceDeal4P(state, action) : reduceDeal2P(state, action);

			return { state: nextState, validation: { success: true } };
		}

		case ACTION_TYPES.DECLARE_TURUP: {
			const validation = validateDeclareTurup({ state, action });
			if (!validation.success) return { state, validation };

			const nextState = reduceDeclareTurup2P(state, action);

			return { state: nextState, validation: { success: true } };
		}

		case ACTION_TYPES.PICKUP_TURUP_CARD: {
			const validation = validatePickupTurup({ state, action });
			if (!validation.success) return { state, validation };

			const nextState = reducePickupTurup2P(state, action);

			return { state: nextState, validation: { success: true } };
		}

		case ACTION_TYPES.PLAY_GHOPTE: {
			const validation = validatePlayGhopte({ state, action });
			if (!validation.success) return { state, validation };

			const nextState = reducePlayGhopte4P(state, action);

			return { state: nextState, validation: { success: true } };
		}

		case ACTION_TYPES.PLAY_CARD: {
			const validation = validatePlayCard({ state, action });
			if (!validation.success) return { state, validation };

			const nextState =
				state.game.mode === GAME_MODES.FOUR_PLAYER ? reducePlayCard4P(state, action) : reducePlayCard2P(state, action);

			return { state: nextState, validation: { success: true } };
		}

		default:
			return {
				state,
				validation: createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Unknown action type"),
			};
	}
}

/**
 * Validate an action without reducing.
 */
export function validateAction({ state, action }: { state: GameState; action: Action }): ValidationResult {
	switch (action.type) {
		case ACTION_TYPES.DEAL:
			return validateDeal({ state, action });
		case ACTION_TYPES.DECLARE_TURUP:
			return validateDeclareTurup({ state, action });
		case ACTION_TYPES.PICKUP_TURUP_CARD:
			return validatePickupTurup({ state, action });
		case ACTION_TYPES.PLAY_GHOPTE:
			return validatePlayGhopte({ state, action });
		case ACTION_TYPES.PLAY_CARD:
			return validatePlayCard({ state, action });
		default:
			return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Unknown action type");
	}
}

// Re-export action functions for public API
export { validateDeal, reduceDeal4P, reduceDeal2P } from "./deal";
export { validateDeclareTurup, reduceDeclareTurup2P } from "./declare-turup";
export { validatePickupTurup, reducePickupTurup2P } from "./pickup-turup";
export { validatePlayGhopte, reducePlayGhopte4P } from "./play-ghopte";
export { validatePlayCard, reducePlayCard4P, reducePlayCard2P } from "./play-card";
