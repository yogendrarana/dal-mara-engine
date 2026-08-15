import { createInitialState, gameReducer } from "../reducers/index";
import type { Action, GameMode, GameState, Player } from "../types/index";
import { ACTION_TYPES, DalMaraError } from "../types/index";
import { validateAction } from "../validators/index";

export interface ReplayData {
	readonly version: string;
	readonly gameId: string;
	readonly mode: GameMode;
	readonly seed: number;
	readonly players: readonly Player[];
	readonly actions: readonly Action[];
}

export function exportReplay(state: GameState): ReplayData {
	return {
		version: "1.0",
		gameId: state.id,
		mode: state.mode,
		seed: state.settings.seed ?? state.rngSeed,
		players: state.players,
		actions: state.actionHistory,
	};
}

export function playReplay(replay: ReplayData): GameState {
	if (!replay || !replay.players || !replay.actions) {
		throw new DalMaraError(
			"Invalid replay data: missing players or actions",
			"INVALID_REPLAY",
		);
	}

	// 1. Recreate initial state using createInitialState
	let state = createInitialState({
		id: replay.gameId,
		mode: replay.mode,
		seed: replay.seed,
		players: replay.players.map((p) => ({ id: p.id, name: p.name })),
	});

	// 2. Apply all actions sequentially
	for (const action of replay.actions) {
		if (
			action.type === ACTION_TYPES.CREATE_GAME ||
			action.type === ACTION_TYPES.JOIN_PLAYER
		) {
			continue;
		}

		const validation = validateAction(state, action);
		if (!validation.success) {
			throw new DalMaraError(
				`Replay action '${action.type}' failed validation: ${validation.error.message}`,
				"REPLAY_VALIDATION_ERROR",
				{ action, error: validation.error },
			);
		}
		state = gameReducer(state, action);
	}

	return state;
}
