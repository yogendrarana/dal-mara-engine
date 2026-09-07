import { parseCard } from "../card";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES } from "../const";
import type { EventDispatcher } from "../../events/dispatcher";
import type { GameState, PickupTurupCardAction, ValidationResult } from "../../types/index";

// Validation

export function validatePickupTurup({ state, action }: { state: GameState; action: PickupTurupCardAction }): ValidationResult {
	const { card } = action.payload;

	if (state.game.mode !== GAME_MODES.TWO_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Pickup Turup action is only valid in 2-Player mode");
	}

	const stacks = state.stacks2P[action.payload.playerId];
	if (!stacks) {
		return createValidationError(ENGINE_ERROR_CODES.STACK_NOT_FOUND, "Player stacks not found");
	}

	const targetStack = stacks.find((s) => s.faceUpCard === card);

	if (!targetStack) {
		return createValidationError(ENGINE_ERROR_CODES.STACK_NOT_FOUND, "Target stack not found");
	}

	if (!targetStack?.faceUpCard || parseCard(targetStack.faceUpCard).suit !== state.game.turup) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Target stack card is not face up or is not Turup suit");
	}

	return { success: true };
}

// Reducer (2-Player only)

export function reducePickupTurup2P(state: GameState, action: PickupTurupCardAction): GameState {
	const nextActions = [...state.actions, action];
	const { playerId, card } = action.payload;

	if (!state.game.turup) return state;

	const playerStacks = state.stacks2P[playerId];
	if (!playerStacks) return state;

	const targetStack = playerStacks.find((s) => s.faceUpCard === card && parseCard(s.faceUpCard).suit === state.game.turup);
	if (!targetStack) return state;

	const targetCard = targetStack.faceUpCard;
	if (!targetCard) return state;

	const currentHand = state.hands[playerId] ?? [];
	const newHand = [...currentHand, targetCard];

	const newHidden = [...targetStack.hiddenCards];
	const nextFaceUp = newHidden.pop() ?? null;

	const newPlayerStacks = [...playerStacks];
	const targetIndex = newPlayerStacks.findIndex((s) => s.position === targetStack.position);

	newPlayerStacks[targetIndex] = {
		...targetStack,
		hiddenCards: newHidden,
		faceUpCard: nextFaceUp,
	};

	return {
		...state,
		hands: {
			...state.hands,
			[playerId]: newHand,
		},
		stacks2P: {
			...state.stacks2P,
			[playerId]: newPlayerStacks,
		},
		actions: nextActions,
	};
}

// Event Emission

export function emitPickupTurupEvents(_options?: {
	prevState?: GameState;
	state?: GameState;
	nextState?: GameState;
	action?: PickupTurupCardAction;
	emitter?: EventDispatcher;
}): void {
	// No events emitted for pickup turup card
}
