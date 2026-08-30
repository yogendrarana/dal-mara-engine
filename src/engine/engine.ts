import type { GameState, ValidationResult } from "../types/index";

import { Game } from "./game";
import { importFromDMN } from "./dmn";
import { deserializeState } from "./serializers";
import { playReplay, type ReplayData } from "./replay";
import { GAME_MODES, GAME_PHASES, GHOPTE_RESOLUTION_ORDER } from "../core/const";

// biome-ignore lint/complexity/noStaticOnlyClass: <engine class with static factories>
export class Engine {
	// play replay - from replay data, start a game from the begining and then play the replay
	public static playReplay(replay: ReplayData): Game | ValidationResult {
		const state = playReplay(replay);
		return Game.create(state);
	}

	// dmn to game state
	public static fromDMN(dmnString: string): Game | ValidationResult {
		const partialState = importFromDMN(dmnString);

		const mode = partialState.mode ?? GAME_MODES.FOUR_PLAYER;
		const players = partialState.players ?? [];
		const dealerId = partialState.dealerId ?? "p1";

		const fullState: GameState = {
			id: partialState.id ?? "game-dmn",
			mode,
			phase: partialState.phase ?? GAME_PHASES.PLAYING,
			settings: { mode, ghopteResolutionOrder: GHOPTE_RESOLUTION_ORDER.DEALER_LAST },
			players,
			dealerId,
			currentTurnPlayerId: partialState.currentTurnPlayerId ?? null,
			hands: partialState.hands ?? {},
			stacks2P: partialState.stacks2P ?? {},
			currentTrick: partialState.currentTrick ?? {
				trickNumber: 1,
				leadSuit: null,
				cards: [],
				winnerId: null,
			},
			currentTurup: partialState.currentTurup ?? null,
			ghopteState: null,
			scores: partialState.scores ?? {},
			trickHistory: [],
			roundNumber: partialState.roundNumber ?? 1,
			winnerTeam: null,
			actionHistory: [],
		};

		return Game.create(fullState);
	}

	public static deserialize(json: string): Game | ValidationResult {
		const state = deserializeState(json);
		return Game.create(state);
	}
}
