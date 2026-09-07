import type { GameState, Player } from "../types/index";

/**
 * Get the player whose turn it currently is based on state.play.playerPosition.
 */
export function getCurrentTurnPlayer(state: GameState): Player | null {
	if (state.play.playerPosition === null) return null;
	return state.players.find((p) => p.position === state.play.playerPosition) ?? null;
}
