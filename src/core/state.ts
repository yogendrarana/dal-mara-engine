import { GAME_PHASES } from "./const";
import { createInitialScoreState } from "./scoring/scoring";
import type { GameMode, GameState, Player, ScoreState } from "../types/index";

export function createInitialState(options: {
	id: string;
	mode: GameMode;
	players: readonly Player[];
	dealerId: string;
}): GameState {
	const { id, mode, players, dealerId } = options;

	const orderedPlayers: Player[] = [...players].sort((a, b) => a.position - b.position);

	const scores: Record<string, ScoreState> = {};
	for (const p of orderedPlayers) {
		scores[p.id] = createInitialScoreState();
	}

	return {
		id,
		mode,
		phase: GAME_PHASES.DEAL,
		settings: { mode },
		players: orderedPlayers,
		dealerId,
		currentTurnPlayerId: null,
		hands: {},
		stacks2P: {},
		currentTrick: {
			trickNumber: 1,
			leadSuit: null,
			cards: [],
			winnerId: null,
		},
		currentTurup: null,
		ghopteState: null,
		scores,
		trickHistory: [],
		roundNumber: 1,
		winnerTeam: null,
		actionHistory: [],
	};
}
