import type { Rank, Suit, SuitAbbreviation } from "../../types";

export const SUITS = {
	SPADES: "spades",
	HEARTS: "hearts",
	DIAMONDS: "diamonds",
	CLUBS: "clubs",
} as const;

export const SUIT_ABBREVIATION: Record<Suit, SuitAbbreviation> = {
	spades: "s",
	hearts: "h",
	diamonds: "d",
	clubs: "c",
} as const;

export const ABBREVIATION_TO_SUIT: Record<SuitAbbreviation, Suit> = {
	s: "spades",
	h: "hearts",
	d: "diamonds",
	c: "clubs",
};

export const RANKS = {
	TWO: "2",
	THREE: "3",
	FOUR: "4",
	FIVE: "5",
	SIX: "6",
	SEVEN: "7",
	EIGHT: "8",
	NINE: "9",
	TEN: "10",
	JACK: "J",
	QUEEN: "Q",
	KING: "K",
	ACE: "A",
} as const;

export const CARD_RANKS: readonly Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

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
} as const;
