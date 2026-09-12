import { compareCardRanks, parseCard } from "../card";
import { RANKS, SUITS } from "../const";
import type { Card, Ghopte, PlayedCard, Seat, Suit, Trick } from "../../types/index";

/**
 * Get anti-clockwise next seat in square arrangement [P0, P1, P2, P3].
 * Sequence: P0 (0) -> P1 (1) -> P2 (2) -> P3 (3) -> P0 (0).
 */
export function getAnticlockwiseNextSeat(currentSeat: number, totalPlayers = 4): number {
	return (currentSeat + 1) % totalPlayers;
}

export const getAnticlockwiseNextPosition = getAnticlockwiseNextSeat;

/**
 * Get first player seat to receive cards / start play.
 * Starts from the player immediately to the dealer's right (anti-clockwise).
 */
export function getFirstPlayerSeat({
	dealerSeat,
	dealerPosition,
	totalPlayers = 4,
}: {
	dealerSeat?: number;
	dealerPosition?: number;
	totalPlayers?: number;
}): number {
	const seat = dealerSeat ?? dealerPosition ?? 0;
	return (seat + 1) % totalPlayers;
}

export const getFirstPlayerPosition = getFirstPlayerSeat;

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
	dealerSeat,
	dealerPosition,
}: {
	deck: readonly Card[];
	dealerSeat?: number;
	dealerPosition?: number;
}): Record<Seat, Card[]> {
	const seat = dealerSeat ?? dealerPosition ?? 0;
	// initialize empty hands keyed by seat
	const hands = {} as Record<Seat, Card[]>;
	for (let i = 0; i < 4; i++) {
		hands[i as Seat] = [];
	}

	let deckIndex = 0;
	const startPos = getFirstPlayerSeat({ dealerSeat: seat, totalPlayers: 4 });

	// deal pass 1: 5 cards each
	let currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const targetHand = hands[currPos as Seat];
		if (!targetHand) {
			throw new Error(`Hand not initialized for seat ${currPos}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 5));
		deckIndex += 5;
		currPos = getAnticlockwiseNextSeat(currPos, 4);
	}

	// deal pass 2: 4 cards each
	currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const targetHand = hands[currPos as Seat];
		if (!targetHand) {
			throw new Error(`Hand not initialized for seat ${currPos}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 4));
		deckIndex += 4;
		currPos = getAnticlockwiseNextSeat(currPos, 4);
	}

	// deal pass 3: 4 cards each
	currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const targetHand = hands[currPos as Seat];
		if (!targetHand) {
			throw new Error(`Hand not initialized for seat ${currPos}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 4));
		deckIndex += 4;
		currPos = getAnticlockwiseNextSeat(currPos, 4);
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
	hands = {} as Record<Seat, readonly Card[]>,
	dealerSeat,
	dealerPosition,
}: {
	hands: Record<Seat, readonly Card[]>;
	dealerSeat?: number;
	dealerPosition?: number;
}): Ghopte[] | null {
	const allGhoptes: Ghopte[] = [];
	const dSeat = dealerSeat ?? dealerPosition ?? 0;

	const total = 4;

	for (let i = 0; i < total; i++) {
		// Normal anti-clockwise direction starting after the dealer (dealer is last)
		const pos = ((dSeat + 1 + i) % total) as Seat;

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
						seat: pos,
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
 * Returns the winning player's seat.
 */
export function resolve4PTrickWinner(options: { trick: Trick; currentTurup: Suit | null }): Seat {
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

	return winningPlayedCard.seat;
}
