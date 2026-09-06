export * from "./two-player";
export * from "./four-player";
import { RANKS } from "../const";
import { getCardRank } from "../card";
import type { Card, CapturedTrickRecord, ScoreState } from "../../types/index";

export function createInitialScoreState(): ScoreState {
	return {
		capturedTens: 0,
		capturedTricks: 0,
		capturedTrickRecords: [],
	};
}

export function countTensInCards(cards: readonly Card[]): number {
	return cards.filter((c) => getCardRank(c) === RANKS.TEN).length;
}

export function updateScoreOnTrickWon(options: {
	currentScore: ScoreState;
	wonCards: readonly Card[];
	trickNumber: number;
	wonByPlayerId: string;
}): ScoreState {
	const { currentScore, wonCards, trickNumber } = options;

	const tensInWon = countTensInCards(wonCards);
	const newRecord: CapturedTrickRecord = {
		trickNumber,
		cards: wonCards,
	};

	return {
		capturedTens: (currentScore?.capturedTens ?? 0) + tensInWon,
		capturedTricks: (currentScore?.capturedTricks ?? 0) + 1,
		capturedTrickRecords: [...(currentScore?.capturedTrickRecords ?? []), newRecord],
	};
}
