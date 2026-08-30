import type { Card, CardId, Rank, Suit, SuitAbbreviation } from "../types/index";
import { ABBREVIATION_TO_SUIT, CARD_RANKS, RANK_VALUE, SUIT_ABBREVIATION } from "./const";

// create card
export function createCard(suit: Suit, rank: Rank): Card {
	const suitAbbr = SUIT_ABBREVIATION[suit];

	return {
		id: `${rank}${suitAbbr}`,
		suit,
		rank,
	};
}

// compare ranks
export function compareCardRanks(a: Card, b: Card): number {
	return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
}

// parse card id
export function parseCardId(id: CardId): Card | null {
	if (!id || id.length < 2) return null;
	const suitAbbr = id.slice(-1) as SuitAbbreviation;
	const rankStr = id.slice(0, -1);

	const suit = ABBREVIATION_TO_SUIT[suitAbbr];
	if (!suit) return null;

	const rank = CARD_RANKS.find((r) => r === rankStr);
	if (!rank) return null;

	return createCard(suit, rank);
}
