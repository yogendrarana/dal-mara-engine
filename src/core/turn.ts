import type { GameState, Player } from "../types/index";

/**
 * Get the player whose turn it currently is based on state.nextMovePlayerPosition.
 */
export function getCurrentTurnPlayer(state: GameState): Player | null {
	return state.players.find((p) => p.position === state.nextMovePlayerPosition) ?? null;
}
