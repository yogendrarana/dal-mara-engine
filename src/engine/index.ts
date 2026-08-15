import { importFromDMN } from "../dmn/index";
import { createInitialState } from "../reducers/index";
import { playReplay, type ReplayData } from "../replay/index";
import { deserializeState } from "../serializers/index";
import type {
	GameMode,
	GameState,
	GhopteResolutionOrder,
} from "../types/index";
import { DalMaraError, GAME_MODES, GAME_PHASES } from "../types/index";
import { Game } from "../game";

// biome-ignore lint/complexity/noStaticOnlyClass: <engine class with static factories>
export class Engine {
	/**
	 * Create a new Game instance.
	 * Requires `id`, `mode`, and the full `players` array.
	 */
	public static createGame(options: {
		id: string;
		mode: GameMode;
		players: readonly { id: string; name: string }[];
		dealerId?: string;
		dealerIndex?: number;
		seed?: number;
		ghopteResolutionOrder?: GhopteResolutionOrder;
	}): Game {
		if (!options.id) {
			throw new DalMaraError(
				"Game id is required to create a game",
				"INVALID_GAME_ID",
			);
		}

		if (!options.mode) {
			throw new DalMaraError(
				"Game mode is required to create a game",
				"INVALID_MODE",
			);
		}

		if (!options.players || !Array.isArray(options.players)) {
			throw new DalMaraError(
				"Players array is required to create a game",
				"INVALID_PLAYERS",
			);
		}

		const expectedCount = options.mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;
		if (options.players.length !== expectedCount) {
			throw new DalMaraError(
				`Game mode '${options.mode}' requires exactly ${expectedCount} players, got ${options.players.length}`,
				"INVALID_PLAYER_COUNT",
				{
					mode: options.mode,
					expected: expectedCount,
					received: options.players.length,
				},
			);
		}

		const initialState = createInitialState({
			id: options.id,
			mode: options.mode,
			players: options.players,
			dealerId: options.dealerId,
			dealerIndex: options.dealerIndex,
			seed: options.seed,
			ghopteResolutionOrder: options.ghopteResolutionOrder,
		});

		return new Game(initialState);
	}

	public static deserialize(json: string): Game {
		const state = deserializeState(json);
		return new Game(state);
	}

	public static fromDMN(dmnString: string): Game {
		const partialState = importFromDMN(dmnString);
		const mode = partialState.mode ?? GAME_MODES.FOUR_PLAYER;
		const players = partialState.players ?? [];
		const dealerIndex = partialState.dealerIndex ?? 0;
		const dealerId = partialState.dealerId ?? players[dealerIndex]?.id ?? "p1";

		const fullState: GameState = {
			id: partialState.id ?? "game-dmn",
			mode,
			phase: partialState.phase ?? GAME_PHASES.PLAYING,
			settings: { mode },
			players,
			dealerId,
			dealerIndex,
			currentTurnPlayerId: partialState.currentTurnPlayerId ?? null,
			hands: partialState.hands ?? {},
			stacks2P: partialState.stacks2P ?? {},
			currentTrick: partialState.currentTrick ?? {
				leadSuit: null,
				cards: [],
				winnerId: null,
			},
			currentTurup: partialState.currentTurup ?? null,
			ghopteState: null,
			scores: partialState.scores ?? {},
			trickHistory: [],
			roundNumber: 1,
			winnerId: null,
			rngSeed: 0,
			rngState: 0,
			actionHistory: [],
		};

		return new Game(fullState);
	}

	public static playReplay(replay: ReplayData): Game {
		const state = playReplay(replay);
		return new Game(state);
	}
}
