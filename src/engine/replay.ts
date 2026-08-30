import type { Action, GameMode, GameState, Player } from "../types/index";
import { DalMaraError } from "../core/errors";
import { validateAction } from "../core/validators";
import { createInitialState } from "../core/state";
import { GAME_MODES, GHOPTE_RESOLUTION_ORDER } from "../core/const";
import { gameReducer4P } from "../core/reducers/four-player";
import { gameReducer2P } from "../core/reducers/two-player";

export interface ReplayData {
	readonly version: string;
	readonly gameId: string;
	readonly mode: GameMode;
	readonly players: readonly Player[];
	readonly actions: readonly Action[];
}

export function exportReplay(state: GameState): ReplayData {
	return {
		version: "1.0",
		gameId: state.id,
		mode: state.mode,
		players: state.players,
		actions: state.actionHistory,
	};
}

export function playReplay(replay: ReplayData): GameState {
	if (!replay?.players || !replay.actions) {
		throw new DalMaraError("Invalid replay data: missing players or actions", "INVALID_REPLAY");
	}

	const dealerId = replay.players[0]?.id ?? "p1";

	// 1. Recreate initial state using createInitialState
	let state = createInitialState({
		id: replay.gameId,
		mode: replay.mode,
		dealerId,
		ghopteResolutionOrder: GHOPTE_RESOLUTION_ORDER.DEALER_LAST,
		players: replay.players.map((p, idx) => ({
			id: p.id,
			name: p.name,
			position: p.position ?? idx,
			team: p.team ?? (idx % 2 === 0 ? "team1" : "team2"),
		})),
	});

	// 2. Apply all actions sequentially
	for (const action of replay.actions) {
		if ((action.type as string) === "CREATE_GAME" || (action.type as string) === "JOIN_PLAYER") {
			continue;
		}

		const validation = validateAction(state, action);
		if (!validation.success) {
			throw new DalMaraError(
				`Replay action '${action.type}' failed validation: ${validation.error.message}`,
				"REPLAY_VALIDATION_ERROR",
				{
					action,
					error: validation.error,
				},
			);
		}

		if (state.mode === GAME_MODES.FOUR_PLAYER) {
			state = gameReducer4P(state, action);
		} else {
			state = gameReducer2P(state, action);
		}
	}

	return state;
}
