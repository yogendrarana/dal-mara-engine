import type { Card, Player, PlayerStack, ScoreState } from "../../types/index";
import { createInitialScoreState } from "./scoring";

export interface GameWinnerResult2P {
	readonly winnerTeam: string | null;
	readonly reason?: string;
}

export function isGameFinished2P(options: {
	totalTricksPlayed: number;
	hands?: Record<string, readonly Card[]>;
	stacks?: Record<string, readonly PlayerStack[]>;
}): boolean {
	const { totalTricksPlayed, hands, stacks } = options;

	if (totalTricksPlayed >= 26) {
		return true;
	}

	if (hands && stacks) {
		const handsEmpty = Object.values(hands).every((h) => h.length === 0);
		const stacksEmpty = Object.values(stacks).every((playerStacks) =>
			playerStacks.every((s) => !s.faceUpCard && s.hiddenCards.length === 0),
		);

		if (handsEmpty && stacksEmpty) {
			return true;
		}
	}

	return false;
}

export function evaluateGameWinner2P(options: {
	scores: Record<string, ScoreState>;
	players: readonly Player[];
}): GameWinnerResult2P {
	const { scores, players } = options;

	const p0 = players[0];
	const p1 = players[1];

	if (!p0 || !p1) {
		throw new Error("2-Player mode requires exactly 2 players in evaluation");
	}

	const p0Score = scores[p0.id] ?? createInitialScoreState();
	const p1Score = scores[p1.id] ?? createInitialScoreState();

	const p0Tricks = p0Score.capturedTricksCount;
	const p1Tricks = p1Score.capturedTricksCount;

	if (p0Score.capturedTensCount > p1Score.capturedTensCount) {
		return {
			winnerTeam: p0.id,
			reason: `${p0.name} wins with ${p0Score.capturedTensCount} tens`,
		};
	}

	if (p1Score.capturedTensCount > p0Score.capturedTensCount) {
		return {
			winnerTeam: p1.id,
			reason: `${p1.name} wins with ${p1Score.capturedTensCount} tens`,
		};
	}

	// 2-2 tens tie broken by tricks
	if (p0Tricks > p1Tricks) {
		return {
			winnerTeam: p0.id,
			reason: `2-2 tie broken by tricks: ${p0.name} (${p0Tricks}) vs ${p1.name} (${p1Tricks})`,
		};
	}

	if (p1Tricks > p0Tricks) {
		return {
			winnerTeam: p1.id,
			reason: `2-2 tie broken by tricks: ${p1.name} (${p1Tricks}) vs ${p0.name} (${p0Tricks})`,
		};
	}

	return {
		winnerTeam: null,
		reason: `Game ended in a draw (equal tens: ${p0Score.capturedTensCount}, equal tricks: ${p0Tricks})`,
	};
}
