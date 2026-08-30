import { createCard } from "./card";
import type { Card } from "../types/index";
import { CARD_RANKS, SUITS } from "./const";

// create deck
export function createDeck(): Card[] {
	const deck: Card[] = [];

	for (const suit of Object.values(SUITS)) {
		for (const rank of CARD_RANKS) {
			deck.push(createCard(suit, rank));
		}
	}

	return deck;
}

/**
 * Shuffles a deck using the Fisher-Yates algorithm.
 * Returns a new shuffled deck without mutating the original.
 */
export function shuffleDeck(deck: readonly Card[]): Card[] {
	const result = [...deck];

	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));

		[result[i], result[j]] = [result[j], result[i]];
	}

	return result;
}
