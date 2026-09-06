import { DalMaraError } from "./errors";
import type { Card, CardDetails, Rank, Suit, SuitAbbreviation } from "../types/index";
import { ABBREVIATION_TO_SUIT, CARD_RANKS, ENGINE_ERROR_CODES, RANK_VALUE, SUIT_ABBREVIATION } from "./const";

/**
 * Parse a card string into its constituent suit and rank.
 */
export function parseCard(card: Card): CardDetails {
	const suitAbbr = card.slice(-1) as SuitAbbreviation;
	const rank = card.slice(0, -1) as Rank;

	const suit = ABBREVIATION_TO_SUIT[suitAbbr];
	if (!suit || !CARD_RANKS.includes(rank)) {
		throw new DalMaraError(`Invalid card: ${card}`, ENGINE_ERROR_CODES.INVALID_ACTION);
	}

	return { suit, rank };
}

/**
 * Get the suit of a card.
 */
export function getCardSuit(card: Card): Suit {
	return parseCard(card).suit;
}

/**
 * Get the rank of a card.
 */
export function getCardRank(card: Card): Rank {
	return parseCard(card).rank;
}

/**
 * Compare two cards by rank value.
 */
export function compareCardRanks(a: Card, b: Card): number {
	return RANK_VALUE[getCardRank(a)] - RANK_VALUE[getCardRank(b)];
}

/**
 * Create a Card string from suit and rank.
 */
export function createCard(suit: Suit, rank: Rank): Card {
	return `${rank}${SUIT_ABBREVIATION[suit]}` as Card;
}
