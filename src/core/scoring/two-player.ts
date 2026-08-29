import type { Card, Player, PlayerStack2P, ScoreState } from "../../types/index";
import { createInitialScoreState } from "./scoring";

export interface GameWinnerResult2P {
	readonly winnerTeam: string | null;
	readonly reason?: string;
}

export function isGameFinished2P(options: {
	totalTricksPlayed: number;
	hands?: Record<string, readonly Card[]>;
	stacks2P?: Record<string, readonly PlayerStack2P[]>;
}): boolean {
	const { totalTricksPlayed, hands, stacks2P } = options;

	if (totalTricksPlayed >= 26) {
		return true;
	}

	if (hands && stacks2P) {
		const handsEmpty = Object.values(hands).every((h) => h.length === 0);
		const stacksEmpty = Object.values(stacks2P).every((playerStacks) =>
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

	const p0Tricks = p0Score.capturedTricks ?? p0Score.capturedTrickRecords.length;
	const p1Tricks = p1Score.capturedTricks ?? p1Score.capturedTrickRecords.length;

	if (p0Score.capturedTens > p1Score.capturedTens) {
		return {
			winnerTeam: p0.id,
			reason: `${p0.name} wins with ${p0Score.capturedTens} tens`,
		};
	}

	if (p1Score.capturedTens > p0Score.capturedTens) {
		return {
			winnerTeam: p1.id,
			reason: `${p1.name} wins with ${p1Score.capturedTens} tens`,
		};
	}

	// @TODO:In 2P mode, there i chance, trick won an 10s won are equal. In that case game is a draw.
	// But this code is not handling that.

	if (p0Tricks >= p1Tricks) {
		return {
			winnerTeam: p0.id,
			reason: `2-2 tie broken by tricks: ${p0.name} (${p0Tricks}) vs ${p1.name} (${p1Tricks})`,
		};
	}

	return {
		winnerTeam: p1.id,
		reason: `2-2 tie broken by tricks: ${p1.name} (${p1Tricks}) vs ${p0.name} (${p0Tricks})`,
	};
}
