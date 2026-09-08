import { GAME_PHASES } from "./const";
import type { GameMode, GameState, Player, PlayerPosition } from "../types/index";

export function createInitialState(options: {
	id?: string;
	mode: GameMode;
	players: readonly Player[];
	dealerPosition: PlayerPosition;
}): GameState {
	const { mode, players, dealerPosition } = options;

	const orderedPlayers: Player[] = [...players].sort((a, b) => a.position - b.position);

	return {
		game: {
			mode,
			dealerPosition,
			turup: null,
			phase: GAME_PHASES.DEAL,
		},
		players: orderedPlayers,
		hands: {},
		stacks: {},
		ghoptes: [],
		moveNumber: 0,
		trick: {
			number: 1,
			playNumber: 0,
			leadSuit: null,
			isGhopte: false,
			cards: [],
		},
		moveDetail: {
			playerPosition: null,
			card: null,
			makesTurup: false,
		},
		nextMovePlayerPosition: dealerPosition,
	};
}
