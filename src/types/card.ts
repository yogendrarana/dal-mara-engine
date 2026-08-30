import type { RANKS, SUITS } from "../core/const";

export type SuitAbbreviation = "s" | "h" | "d" | "c";

export type Suit = (typeof SUITS)[keyof typeof SUITS];

export type Rank = (typeof RANKS)[keyof typeof RANKS];

export type CardId = `${Rank}${SuitAbbreviation}`;

export interface Card {
	readonly id: CardId;
	readonly suit: Suit;
	readonly rank: Rank;
}

export interface PlayedCard {
	readonly playerId: string;
	readonly card: Card;
	readonly playOrder: number;
}
