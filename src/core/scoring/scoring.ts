export * from "./two-player";
export * from "./four-player";
import { RANKS } from "../const";
import { getCardRank } from "../card";
import type { Card, ScoreState, Trick } from "../../types/index";

export function createInitialScoreState(): ScoreState {
	return {
		capturedTensCount: 0,
		capturedTricksCount: 0,
		capturedTricks: [],
	};
}

export function countTensInCards(cards: readonly Card[]): number {
	return cards.filter((c) => getCardRank(c) === RANKS.TEN).length;
}

export function updateScoreOnTrickWon(options: { currentScore: ScoreState; trick: Trick }): ScoreState {
	const { currentScore, trick } = options;
	const wonCards = trick.cards.map((pc) => pc.card);
	const tensInWon = countTensInCards(wonCards);

	return {
		capturedTensCount: (currentScore?.capturedTensCount ?? 0) + tensInWon,
		capturedTricksCount: (currentScore?.capturedTricksCount ?? 0) + 1,
		capturedTricks: [...(currentScore?.capturedTricks ?? []), trick],
	};
}
