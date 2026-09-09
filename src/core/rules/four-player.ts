import { compareCardRanks, parseCard } from "../card";
import { RANKS, SUITS } from "../const";
import type { Card, Ghopte, PlayedCard, Player, PlayerPosition, Suit, Trick } from "../../types/index";

/**
 * Get anti-clockwise next seat in square arrangement [P0, P1, P2, P3].
 * Sequence: P0 (0) -> P1 (1) -> P2 (2) -> P3 (3) -> P0 (0).
 */
export function getAnticlockwiseNextPosition(currentPos: number, totalPlayers = 4): number {
	return (currentPos + 1) % totalPlayers;
}

/**
 * Get first player index to receive cards / start play.
 * Starts from the player immediately to the dealer's right (anti-clockwise).
 */
export function getFirstPlayerPosition({
	dealerPosition,
	totalPlayers = 4,
}: {
	dealerPosition: number;
	totalPlayers: number;
}): number {
	return (dealerPosition + 1) % totalPlayers;
}

/**
 * 4-Player Deal distribution:
 * Pass 1: 5 cards to each player (total 20)
 * Pass 2: 4 cards to each player (total 16)
 * Pass 3: 4 cards to each player (total 16)
 *
 * Total 52 cards. Dealt anticlockwise starting from dealer's right.
 */
export function dealFourPlayer({
	deck,
	dealerPosition,
}: {
	deck: readonly Card[];
	dealerPosition: number;
}): Record<PlayerPosition, Card[]> {
	// initialize empty hands keyed by position
	const hands = {} as Record<PlayerPosition, Card[]>;
	for (let i = 0; i < 4; i++) {
		hands[i as PlayerPosition] = [];
	}

	let deckIndex = 0;
	const startPos = getFirstPlayerPosition({ dealerPosition, totalPlayers: 4 });

	// deal pass 1: 5 cards each
	let currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const targetHand = hands[currPos as PlayerPosition];
		if (!targetHand) {
			throw new Error(`Hand not initialized for position ${currPos}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 5));
		deckIndex += 5;
		currPos = getAnticlockwiseNextPosition(currPos, 4);
	}

	// deal pass 2: 4 cards each
	currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const targetHand = hands[currPos as PlayerPosition];
		if (!targetHand) {
			throw new Error(`Hand not initialized for position ${currPos}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 4));
		deckIndex += 4;
		currPos = getAnticlockwiseNextPosition(currPos, 4);
	}

	// deal pass 3: 4 cards each
	currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const targetHand = hands[currPos as PlayerPosition];
		if (!targetHand) {
			throw new Error(`Hand not initialized for position ${currPos}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 4));
		deckIndex += 4;
		currPos = getAnticlockwiseNextPosition(currPos, 4);
	}

	return hands;
}

/**
 * Detect Ghopte condition across ALL players:
 * A player holds exactly one card of a suit, and that card is a 10.
 * Returns all detected Ghoptes ordered in sequence according to resolutionOrder:
 * - "dealer-last" (default): starts from dealer's right, ending with dealer
 * - "dealer-first": starts from dealer
 */
export function detectGhopte({
	hands = {} as Record<PlayerPosition, readonly Card[]>,
	dealerPosition = 0,
}: {
	hands: Record<PlayerPosition, readonly Card[]>;
	dealerPosition?: number;
}): Ghopte[] | null {
	const allGhoptes: Ghopte[] = [];

	const total = 4;

	for (let i = 0; i < total; i++) {
		// Normal anti-clockwise direction starting after the dealer (dealer is last)
		const pos = ((dealerPosition + 1 + i) % total) as PlayerPosition;

		const hand = hands[pos] ?? [];
		const suitCounts: Record<Suit, Card[]> = {
			[SUITS.SPADES]: [],
			[SUITS.HEARTS]: [],
			[SUITS.DIAMONDS]: [],
			[SUITS.CLUBS]: [],
		};

		for (const card of hand) {
			suitCounts[parseCard(card).suit].push(card);
		}

		for (const cards of Object.values(suitCounts)) {
			if (cards.length === 1) {
				const card = cards[0];

				if (card && parseCard(card).rank === RANKS.TEN) {
					allGhoptes.push({
						order: allGhoptes.length,
						playerPosition: pos,
						card,
						resolved: false,
					});
				}
			}
		}
	}

	if (allGhoptes.length === 0) {
		return null;
	}

	return allGhoptes;
}

/**
 * Check follow-suit rule in 4P mode.
 */
export function validateFollowSuit({
	hand,
	cardToPlay,
	leadSuit,
}: {
	hand: readonly Card[];
	cardToPlay: Card;
	leadSuit: Suit | null;
}): boolean {
	if (!leadSuit) return true;
	if (parseCard(cardToPlay).suit === leadSuit) return true;

	const hasLeadSuit = hand.some((c) => parseCard(c).suit === leadSuit);
	return !hasLeadSuit;
}

/**
 * Determine winner of a completed 4-Player trick.
 * In 4P mode, active Turup is passed in `currentTurup`.
 * Returns the winning player's position.
 */
export function resolve4PTrickWinner(options: { trick: Trick; currentTurup: Suit | null }): PlayerPosition {
	const { trick, currentTurup } = options;

	const firstCard = trick.cards[0];
	if (!firstCard) {
		throw new Error("Cannot resolve empty trick");
	}

	const leadSuit = trick.leadSuit;
	let winningPlayedCard: PlayedCard = firstCard;

	for (let i = 1; i < trick.cards.length; i++) {
		const current = trick.cards[i];
		if (!current) continue;

		const currentCardSuit = parseCard(current.card).suit;
		const winningCardSuit = parseCard(winningPlayedCard.card).suit;

		if (currentTurup) {
			if (currentCardSuit === currentTurup) {
				if (winningCardSuit !== currentTurup || compareCardRanks(current.card, winningPlayedCard.card) > 0) {
					winningPlayedCard = current;
				}
				continue;
			}

			if (winningCardSuit === currentTurup) continue;
		}

		if (
			currentCardSuit === leadSuit &&
			(winningCardSuit !== leadSuit || compareCardRanks(current.card, winningPlayedCard.card) > 0)
		) {
			winningPlayedCard = current;
		}
	}

	return winningPlayedCard.playerPosition;
}
