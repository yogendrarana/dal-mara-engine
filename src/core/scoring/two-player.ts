import type { Card, Player, Seat, PlayerStack, ScoreState } from "../../types/index";
import { createInitialScoreState } from "./scoring";

export interface GameWinnerResult2P {
	readonly winnerSeat: Seat | null;
	readonly winnerPosition?: Seat | null;
	readonly reason?: string;
}

export function isGameFinished2P(options: {
	totalTricksPlayed: number;
	hands?: Record<Seat, readonly Card[]>;
	stacks?: Record<Seat, readonly PlayerStack[]>;
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
	scores: Record<Seat, ScoreState>;
	players: readonly Player[];
}): GameWinnerResult2P {
	const { scores, players } = options;

	const p0 = players[0];
	const p1 = players[1];

	if (!p0 || !p1) {
		throw new Error("2-Player mode requires exactly 2 players in evaluation");
	}

	const p0Score = scores[p0.seat] ?? createInitialScoreState();
	const p1Score = scores[p1.seat] ?? createInitialScoreState();

	const p0Tricks = p0Score.capturedTricksCount;
	const p1Tricks = p1Score.capturedTricksCount;

	if (p0Score.capturedTensCount > p1Score.capturedTensCount) {
		return {
			winnerSeat: p0.seat,
			winnerPosition: p0.seat,
			reason: `Player at seat ${p0.seat} wins with ${p0Score.capturedTensCount} tens`,
		};
	}

	if (p1Score.capturedTensCount > p0Score.capturedTensCount) {
		return {
			winnerSeat: p1.seat,
			winnerPosition: p1.seat,
			reason: `Player at seat ${p1.seat} wins with ${p1Score.capturedTensCount} tens`,
		};
	}

	// 2-2 tens tie broken by tricks
	if (p0Tricks > p1Tricks) {
		return {
			winnerSeat: p0.seat,
			winnerPosition: p0.seat,
			reason: `2-2 tie broken by tricks: Player at seat ${p0.seat} (${p0Tricks}) vs Player at seat ${p1.seat} (${p1Tricks})`,
		};
	}

	if (p1Tricks > p0Tricks) {
		return {
			winnerSeat: p1.seat,
			winnerPosition: p1.seat,
			reason: `2-2 tie broken by tricks: Player at seat ${p1.seat} (${p1Tricks}) vs Player at seat ${p0.seat} (${p0Tricks})`,
		};
	}

	return {
		winnerSeat: null,
		winnerPosition: null,
		reason: `Game ended in a draw (equal tens: ${p0Score.capturedTensCount}, equal tricks: ${p0Tricks})`,
	};
}
