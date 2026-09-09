import { GAME_MODES, GAME_PHASES } from "./const";
import type { Card, GameMode, GameState, Player, PlayerPosition, PlayerStack } from "../types/index";

export function createInitialState(options: {
	mode: GameMode;
	players: readonly Player[];
	dealerPosition: PlayerPosition;
}): GameState {
	const { mode, players, dealerPosition } = options;

	const orderedPlayers: Player[] = [...players]
		.sort((a, b) => a.position - b.position)
		.map((p) => ({
			position: p.position,
			team: p.team ?? (mode === GAME_MODES.FOUR_PLAYER ? (p.position % 2 === 0 ? "02" : "13") : String(p.position)),
		}));

	return {
		game: {
			mode,
			dealerPosition,
			turup: null,
			phase: GAME_PHASES.DEAL,
		},
		players: orderedPlayers,
		hands: {} as Record<PlayerPosition, readonly Card[]>,
		stacks: {} as Record<PlayerPosition, readonly PlayerStack[]>,
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
