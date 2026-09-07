import type { Card, Player, ScoreState } from "../../types/index";
import { ENGINE_ERROR_CODES } from "../const";
import { DalMaraError } from "../errors";
import { createInitialScoreState } from "./scoring";

export interface GameWinnerResult4P {
	readonly winnerTeam: string | null;
	readonly reason?: string;
}

export function isGameFinished4P(options: { totalTricksPlayed: number; hands?: Record<string, readonly Card[]> }): boolean {
	const { totalTricksPlayed, hands } = options;

	if (totalTricksPlayed >= 13) {
		return true;
	}

	if (hands) {
		const handsEmpty = Object.values(hands).every((h) => h.length === 0);
		if (handsEmpty) {
			return true;
		}
	}

	return false;
}

export function evaluateGameWinner4P(options: {
	scores: Record<string, ScoreState>;
	players: readonly Player[];
}): GameWinnerResult4P {
	const { scores, players } = options;

	const p0 = players.find((p) => p.position === 0);
	const p1 = players.find((p) => p.position === 1);

	if (!p0 || !p1) {
		throw new DalMaraError("Players not found in players array.", ENGINE_ERROR_CODES.INVALID_PLAYERS);
	}

	const team1 = p0.team;
	const team2 = p1.team;

	let team1Tens = 0;
	let team1Tricks = 0;

	let team2Tens = 0;
	let team2Tricks = 0;

	for (const p of players) {
		const pScore = scores[p.id] ?? createInitialScoreState();
		const pTricks = pScore.capturedTricksCount;

		if (p.team === team1) {
			team1Tens += pScore.capturedTensCount;
			team1Tricks += pTricks;
		} else {
			team2Tens += pScore.capturedTensCount;
			team2Tricks += pTricks;
		}
	}

	if (team1Tens > team2Tens) {
		return {
			winnerTeam: team1,
			reason: `Team ${team1} wins with ${team1Tens} tens`,
		};
	}

	if (team2Tens > team1Tens) {
		return {
			winnerTeam: team2,
			reason: `Team ${team2} wins with ${team2Tens} tens`,
		};
	}

	// 2-2 tie broken by total tricks
	if (team1Tricks >= team2Tricks) {
		return {
			winnerTeam: team1,
			reason: `2-2 tie broken by tricks: Team ${team1} (${team1Tricks}) vs Team ${team2} (${team2Tricks})`,
		};
	}
	return {
		winnerTeam: team2,
		reason: `2-2 tie broken by tricks: Team ${team2} (${team2Tricks}) vs Team ${team1} (${team1Tricks})`,
	};
}
