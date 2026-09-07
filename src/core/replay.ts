import type { Action, GameMode, GameState, Player, PlayerPosition } from "../types/index";
import { DalMaraError } from "./errors";
import { validateAction } from "./validators";
import { createInitialState } from "./state";
import { GAME_MODES } from "./const";
import { gameReducer4P } from "./reducers/four-player";
import { gameReducer2P } from "./reducers/two-player";

export interface ReplayData {
	readonly version: string;
	readonly gameId: string;
	readonly mode: GameMode;
	readonly dealerPosition?: PlayerPosition;
	readonly players: readonly Player[];
	readonly actions: readonly Action[];
}

export function exportReplay(state: GameState): ReplayData {
	return {
		version: "1.0",
		gameId: state.id,
		mode: state.game.mode,
		dealerPosition: state.game.dealerPosition,
		players: state.players,
		actions: state.actions,
	};
}

export function playReplay(replay: ReplayData): GameState {
	if (!replay?.players || !replay.actions) {
		throw new DalMaraError("Invalid replay data: missing players or actions", "INVALID_REPLAY");
	}

	const dealerPosition = replay.dealerPosition ?? ((replay.players[0]?.position ?? 0) as PlayerPosition);

	// 1. Recreate initial state using createInitialState
	let state = createInitialState({
		id: replay.gameId,
		mode: replay.mode,
		dealerPosition,
		players: replay.players.map((p, idx) => ({
			id: p.id,
			name: p.name,
			position: (p.position ?? idx) as PlayerPosition,
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

		if (state.game.mode === GAME_MODES.FOUR_PLAYER) {
			state = gameReducer4P(state, action);
		} else {
			state = gameReducer2P(state, action);
		}
	}

	return state;
}
