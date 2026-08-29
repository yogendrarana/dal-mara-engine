import { SUITS } from "./constants";
import type { Card, CardId, Rank, Suit } from "../types/index";

export const RANKS: readonly Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export const RANK_VALUE: Record<Rank, number> = {
	"2": 2,
	"3": 3,
	"4": 4,
	"5": 5,
	"6": 6,
	"7": 7,
	"8": 8,
	"9": 9,
	"10": 10,
	J: 11,
	Q: 12,
	K: 13,
	A: 14,
};

export type SuitAbbreviation = "s" | "h" | "d" | "c";

export const SUIT_ABBREVIATION: Record<Suit, SuitAbbreviation> = {
	spades: "s",
	hearts: "h",
	diamonds: "d",
	clubs: "c",
};

export const ABBREVIATION_TO_SUIT: Record<SuitAbbreviation, Suit> = {
	s: "spades",
	h: "hearts",
	d: "diamonds",
	c: "clubs",
};

// create card
export function createCard(suit: Suit, rank: Rank): Card {
	const suitAbbr = SUIT_ABBREVIATION[suit];

	return {
		id: `${rank}${suitAbbr}`,
		suit,
		rank,
	};
}

// create deck
export function createDeck(): Card[] {
	const deck: Card[] = [];

	for (const suit of Object.values(SUITS)) {
		for (const rank of RANKS) {
			deck.push(createCard(suit, rank));
		}
	}

	return deck;
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

	const rank = RANKS.find((r) => r === rankStr);
	if (!rank) return null;

	return createCard(suit, rank);
}
