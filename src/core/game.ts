import { dispatchAction } from "./actions";
import { createInitialState } from "./state";
import { getCurrentTurnPlayer } from "./turn";
import { parseDMN, serializeDMN } from "./dmn";
import { validateCreateGame } from "./validators";
import { ACTION_TYPES, GAME_PHASES } from "./const";
import { getLegalMoves as getLegalMovesInternal } from "./legal-moves";

import type {
	Action,
	DealAction,
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

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export type ActionResult =
	| { readonly success: true; readonly dmn: string; readonly state: GameState }
	| { readonly success: false; readonly error: EngineError };

export interface CreateGameOptions {
	readonly mode: GameMode;
	readonly players: readonly Player[];
	readonly dealerSeat: Seat;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveState(dmnOrState: string | GameState): GameState {
	return typeof dmnOrState === "string" ? parseDMN(dmnOrState) : dmnOrState;
}

// ---------------------------------------------------------------------------
// Game Creation
// ---------------------------------------------------------------------------

/**
 * Create a new game. Returns initial DMN + state (pre-deal, like FEN starting position).
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

// ---------------------------------------------------------------------------
// Unified Dispatch
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-Action Convenience Functions
// ---------------------------------------------------------------------------

export function deal(dmnOrState: string | GameState, payload: DealAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.DEAL, payload });
}

export function declareTurup(dmnOrState: string | GameState, payload: DeclareTurupAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.DECLARE_TURUP, payload });
}

export function pickupTurupCard(dmnOrState: string | GameState, payload: PickupTurupCardAction["payload"]): ActionResult {
	return dispatch(dmnOrState, { type: ACTION_TYPES.PICKUP_TURUP_CARD, payload });
}

export function playCard(dmnOrState: string | GameState, payload: PlayCardAction["payload"]): ActionResult {
	const state = resolveState(dmnOrState);

	// Auto-route to ghopte if in ghopte phase
	if (state.game.phase === GAME_PHASES.GHOPTE) {
		return dispatch(state, { type: ACTION_TYPES.PLAY_GHOPTE, payload });
	}

	return dispatch(state, { type: ACTION_TYPES.PLAY_CARD, payload });
}

// ---------------------------------------------------------------------------
// Query Functions
// ---------------------------------------------------------------------------

export function getLegalMoves(dmnOrState: string | GameState, seat: Seat): LegalPlayableCard[] {
	const state = resolveState(dmnOrState);
	return getLegalMovesInternal(state, seat);
}

export function getCurrentPlayer(dmnOrState: string | GameState): Player | null {
	const state = resolveState(dmnOrState);
	return getCurrentTurnPlayer(state);
}

export function isFinished(dmnOrState: string | GameState): boolean {
	const state = resolveState(dmnOrState);
	return state.game.phase === GAME_PHASES.END;
}
