import type {
	Card,
	CapturedTrickRecord,
	GameMode,
	Player,
	PlayerStack2P,
	ScoreState,
} from "../types/index";
import { GAME_MODES, RANKS, TEAMS } from "../types/index";

export interface GameWinnerResult {
	readonly isFinished: boolean;
	readonly winnerId: string | null;
	readonly winnerTeamId?: string | null;
	readonly reason?: string;
}

export function createInitialScoreState(): ScoreState {
	return {
		capturedTens: 0,
		capturedTricks: 0,
		capturedCards: [],
		capturedTrickRecords: [],
	};
}

export function countTensInCards(cards: readonly Card[]): number {
	return cards.filter((c) => c.rank === RANKS.TEN).length;
}

export function updateScoreOnTrickWon(options: {
	currentScore: ScoreState;
	wonCards: readonly Card[];
	roundNumber: number;
	wonByPlayerId: string;
}): ScoreState {
	const { currentScore, wonCards, roundNumber, wonByPlayerId } = options;
	const tensInWon = countTensInCards(wonCards);
	const newRecord: CapturedTrickRecord = {
		roundNumber,
		cards: wonCards,
		wonByPlayerId,
	};

	return {
		capturedTens: currentScore.capturedTens + tensInWon,
		capturedTricks: currentScore.capturedTricks + 1,
		capturedCards: [...currentScore.capturedCards, ...wonCards],
		capturedTrickRecords: [...currentScore.capturedTrickRecords, newRecord],
	};
}

export function evaluateGameWinner(options: {
	mode: GameMode;
	scores: Record<string, ScoreState>;
	players: readonly Player[];
	totalTricksPlayed: number;
	hands?: Record<string, readonly Card[]>;
	stacks2P?: Record<string, readonly PlayerStack2P[]>;
}): GameWinnerResult {
	const { mode, scores, players, totalTricksPlayed, hands, stacks2P } = options;
	const maxTricks = mode === GAME_MODES.FOUR_PLAYER ? 13 : 26;

	let allCardsPlayed = totalTricksPlayed >= maxTricks;
	if (!allCardsPlayed && hands) {
		const handsEmpty = Object.values(hands).every((h) => h.length === 0);
		let stacksEmpty = true;
		if (mode === GAME_MODES.TWO_PLAYER && stacks2P) {
			stacksEmpty = Object.values(stacks2P).every((playerStacks) =>
				playerStacks.every((s) => !s.faceUpCard && s.hiddenCards.length === 0),
			);
		}
		if (handsEmpty && stacksEmpty) {
			allCardsPlayed = true;
		}
	}

	// All rounds MUST be played to completion before declaring game finished!
	if (!allCardsPlayed) {
		return {
			isFinished: false,
			winnerId: null,
		};
	}

	if (mode === GAME_MODES.FOUR_PLAYER) {
		// Calculate Team 1 (P0 + P2) and Team 2 (P1 + P3) scores from individual player scores
		let team1Tens = 0;
		let team1Tricks = 0;
		let team2Tens = 0;
		let team2Tricks = 0;

		for (const p of players) {
			const pScore = scores[p.id] ?? createInitialScoreState();
			if (p.teamId === TEAMS.TEAM_1) {
				team1Tens += pScore.capturedTens;
				team1Tricks += pScore.capturedTricks;
			} else {
				team2Tens += pScore.capturedTens;
				team2Tricks += pScore.capturedTricks;
			}
		}

		if (team1Tens > team2Tens) {
			return {
				isFinished: true,
				winnerId: TEAMS.TEAM_1,
				winnerTeamId: TEAMS.TEAM_1,
				reason: `Team 1 wins with ${team1Tens} tens`,
			};
		}
		if (team2Tens > team1Tens) {
			return {
				isFinished: true,
				winnerId: TEAMS.TEAM_2,
				winnerTeamId: TEAMS.TEAM_2,
				reason: `Team 2 wins with ${team2Tens} tens`,
			};
		}

		// 2-2 tie broken by total tricks
		if (team1Tricks >= team2Tricks) {
			return {
				isFinished: true,
				winnerId: TEAMS.TEAM_1,
				winnerTeamId: TEAMS.TEAM_1,
				reason: `2-2 tie broken by tricks: Team 1 (${team1Tricks}) vs Team 2 (${team2Tricks})`,
			};
		}
		return {
			isFinished: true,
			winnerId: TEAMS.TEAM_2,
			winnerTeamId: TEAMS.TEAM_2,
			reason: `2-2 tie broken by tricks: Team 2 (${team2Tricks}) vs Team 1 (${team1Tricks})`,
		};
	} else {
		// 2-Player mode
		const p0 = players[0];
		const p1 = players[1];

		if (!p0 || !p1) {
			throw new Error("2-Player mode requires exactly 2 players in evaluation");
		}

		const p0Score = scores[p0.id] ?? createInitialScoreState();
		const p1Score = scores[p1.id] ?? createInitialScoreState();

		if (p0Score.capturedTens > p1Score.capturedTens) {
			return {
				isFinished: true,
				winnerId: p0.id,
				reason: `${p0.name} wins with ${p0Score.capturedTens} tens`,
			};
		}
		if (p1Score.capturedTens > p0Score.capturedTens) {
			return {
				isFinished: true,
				winnerId: p1.id,
				reason: `${p1.name} wins with ${p1Score.capturedTens} tens`,
			};
		}
		if (p0Score.capturedTricks >= p1Score.capturedTricks) {
			return {
				isFinished: true,
				winnerId: p0.id,
				reason: `2-2 tie broken by tricks: ${p0.name} (${p0Score.capturedTricks}) vs ${p1.name} (${p1Score.capturedTricks})`,
			};
		}
		return {
			isFinished: true,
			winnerId: p1.id,
			reason: `2-2 tie broken by tricks: ${p1.name} (${p1Score.capturedTricks}) vs ${p0.name} (${p0Score.capturedTricks})`,
		};
	}
}
