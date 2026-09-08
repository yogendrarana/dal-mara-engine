import { GAME_PHASES } from "./const";
import { createInitialScoreState } from "./scoring/scoring";
import type { GameMode, GameState, Player, PlayerPosition, ScoreState } from "../types/index";

export function createInitialState(options: {
	id: string;
	mode: GameMode;
	players: readonly Player[];
	dealerPosition: PlayerPosition;
}): GameState {
	const { id, mode, players, dealerPosition } = options;

	const orderedPlayers: Player[] = [...players].sort((a, b) => a.position - b.position);

	const scores: Record<string, ScoreState> = {};
	for (const p of orderedPlayers) {
		scores[p.id] = createInitialScoreState();
	}

	const initialLeaderPosition = ((dealerPosition + 1) % orderedPlayers.length) as PlayerPosition;

	return {
		id,
		game: {
			mode,
			dealerPosition,
			turup: null,
			phase: GAME_PHASES.DEAL,
		},
		players: orderedPlayers,
		hands: {},
		stacks2P: {},
		ghopteState: null,
		play: {
			number: 0,
			card: null,
			playerPosition: null,
			isGhopte: false,
			isTurup: false,
			makesTurup: false,
		},
		trick: {
			number: 1,
			playNumber: 1,
			leadSuit: null,
			leaderPosition: initialLeaderPosition,
			isGhopte: false,
			cards: [],
			nextLeaderPosition: null,
			winnerPosition: null,
		},
		scoring: {
			scores,
		},
	};
}
