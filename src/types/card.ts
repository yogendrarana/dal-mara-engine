import type { RANKS, SUITS } from "../core/const";

export type SuitAbbreviation = "s" | "h" | "d" | "c";

export type Suit = (typeof SUITS)[keyof typeof SUITS];

export type Rank = (typeof RANKS)[keyof typeof RANKS];

export type Card = `${Rank}${SuitAbbreviation}`;

export interface CardDetails {
	readonly suit: Suit;
	readonly rank: Rank;
}
