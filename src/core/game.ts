import { dispatchAction } from "./actions";
import { createInitialState } from "./state";
import { getCurrentTurnPlayer } from "./turn";
import { parseDMN, serializeDMN } from "./dmn";
import { validateCreateGame } from "./validators";
import { ACTION_TYPES, GAME_MODES } from "./const";
import { getLegalMoves as getLegalMovesInternal } from "./legal-moves";
import { getRemainingCards2P as getRemainingCards2PInternal } from "./rules/two-player";

import type {
	Action,
	Card,
	DealFourPlayerAction,
	DealTwoPlayerHandsAction,
	DealTwoPlayerStacksAction,
	DeclareTurupAction,
	EngineError,
	GameMode,
	GameState,
	PickupTurupCardAction,
	PlayCardAction,
	Player,
	Seat,
} from "../types/index";

import type { LegalPlayableCard } from "./legal-moves";

/**
 * Result Types
 */
export type ActionResult =
	| { readonly success: true; readonly dmn: string; readonly state: GameState }
	| { readonly success: false; readonly error: EngineError };

export interface CreateGameOptions {
	readonly mode: GameMode;
	readonly players: readonly Player[];
	readonly dealerSeat: Seat;
}

/**
 * Helper functions
 */
function resolveState(dmnOrState: string | GameState): GameState {
	return typeof dmnOrState === "string" ? parseDMN(dmnOrState) : dmnOrState;
}

/**
 * Create a new game. Returns initial DMN + state.
 */
export function createGame(options: CreateGameOptions): ActionResult {
	const validation = validateCreateGame(options);

	if (!validation.success) {
		return { success: false, error: validation.error };
	}

	const state = createInitialState(options);
	const dmn = serializeDMN(state);

	return { success: true, dmn, state };
}

/**
 * Dispatch any action against a DMN string or GameState.
 * Returns next DMN + state on success.
 */
export function dispatch(dmnOrState: string | GameState, action: Action): ActionResult {
	const state = resolveState(dmnOrState);
	const result = dispatchAction({ state, action });

	if (!result.validation.success) {
		return { success: false, error: result.validation.error };
	}

	const dmn = serializeDMN(result.state);
	return { success: true, dmn, state: result.state };
}

/**
 * Per-Action Convenience Functions
 */

export function dealFourPlayer(dmnOrState: string | GameState, payload: DealFourPlayerAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.DEAL_FOUR_PLAYER, payload });
}

export function dealTwoPlayerHands(dmnOrState: string | GameState, payload: DealTwoPlayerHandsAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.DEAL_TWO_PLAYER_HANDS, payload });
}

export function dealTwoPlayerStacks(dmnOrState: string | GameState, payload: DealTwoPlayerStacksAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.DEAL_TWO_PLAYER_STACKS, payload });
}

export function declareTurup(dmnOrState: string | GameState, payload: DeclareTurupAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.DECLARE_TURUP, payload });
}

export function pickupTurupCard(dmnOrState: string | GameState, payload: PickupTurupCardAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.PICKUP_TURUP_CARD, payload });
}

export function playCard(dmnOrState: string | GameState, payload: PlayCardAction["payload"]): ActionResult {
	const state = resolveState(dmnOrState);

	// Auto-route to ghopte if unresolved ghoptes exist
	if (state.ghoptes.some((g) => !g.resolved)) {
		return dispatch(state, { type: ACTION_TYPES.PLAY_GHOPTE, payload });
	}

	return dispatch(state, { type: ACTION_TYPES.PLAY_CARD, payload });
}

/**
 * Query Functions
 */
export function getLegalMoves(dmnOrState: string | GameState, seat: Seat): LegalPlayableCard[] {
	const state = resolveState(dmnOrState);
	return getLegalMovesInternal(state, seat);
}

export function getCurrentPlayer(dmnOrState: string | GameState): Player | null {
	const state = resolveState(dmnOrState);
	return getCurrentTurnPlayer(state);
}

export function getRemainingCards2P(dmnOrState: string | GameState, originalDeck?: readonly Card[]): Card[] {
	const state = resolveState(dmnOrState);
	return getRemainingCards2PInternal(state, originalDeck);
}

export function isFinished(dmnOrState: string | GameState): boolean {
	const state = resolveState(dmnOrState);
	if (state.moveNumber === 0) return false;
	const allHandsEmpty = Object.values(state.hands).every((h) => h.length === 0);
	if (state.game.mode === GAME_MODES.FOUR_PLAYER) {
		return allHandsEmpty;
	}
	const allStacksEmpty = Object.values(state.stacks).every((pStacks) =>
		pStacks.every((s) => !s.faceUpCard && s.hiddenCards.length === 0),
	);
	return allHandsEmpty && allStacksEmpty;
}
