import { compareCardRanks, parseCard } from "../card";
import { createDeck } from "../deck";
import type { Card, Seat, PlayerStack, Suit, Trick, GameState } from "../../types/index";

/**
 * Checks whether stacks have been dealt in 2-Player mode.
 * - If moveNumber > 0, cards have already been played, so stacks were definitely dealt.
 * - If moveNumber === 0, checks if any cards currently exist in the stacks.
 */
export function hasDealtStacks2P(state: GameState): boolean {
	if (state.moveNumber > 0) {
		return true;
	}
	return Object.values(state.stacks).some((pStacks) => pStacks.some((s) => s.faceUpCard !== null || s.hiddenCards.length > 0));
}

/**
 * 2-Player initial deal:
 * 6 cards to opponent (non-dealer), 6 cards to dealer.
 */
export function dealTwoPlayer({
	deck,
	dealerSeat,
	dealerPosition,
}: {
	deck: readonly Card[];
	dealerSeat?: number;
	dealerPosition?: number;
}): {
	hands: Record<Seat, Card[]>;
	remainingDeck: Card[];
} {
	const dSeat = dealerSeat ?? dealerPosition ?? 0;
	const nonDealerSeat = ((dSeat + 1) % 2) as Seat;
	const dealerSeatVal = dSeat as Seat;

	const nonDealerHand = deck.slice(0, 6);
	const dealerHand = deck.slice(6, 12);
	const remainingDeck = deck.slice(12);

	return {
		hands: {
			[nonDealerSeat]: nonDealerHand,
			[dealerSeatVal]: dealerHand,
		} as Record<Seat, Card[]>,
		remainingDeck,
	};
}

/**
 * Deal remaining 40 cards into 4 hidden stacks per player (5 cards per stack).
 * Alternating order between non-dealer and dealer corresponding stacks:
 * Pass 1 to 5:
 * - Card to Non-Dealer Stack 0, then Dealer Stack 0
 * - Card to Non-Dealer Stack 1, then Dealer Stack 1
 * - Card to Non-Dealer Stack 2, then Dealer Stack 2
 * - Card to Non-Dealer Stack 3, then Dealer Stack 3
 */

const buildPlayerStacks = (stacks: Card[][]): PlayerStack[] => {
	return stacks.map((stackCards, sIdx) => {
		const hiddenCards = stackCards.slice(0, 4);
		const faceUpCard = stackCards[4] ?? null;

		return {
			position: sIdx,
			hiddenCards,
			faceUpCard,
		};
	});
};

export function create2PStacks({
	remainingDeck,
	dealerSeat,
	dealerPosition,
}: {
	remainingDeck: readonly Card[];
	dealerSeat?: number;
	dealerPosition?: number;
}): Record<Seat, PlayerStack[]> {
	const dSeat = dealerSeat ?? dealerPosition ?? 0;
	const nonDealerSeat = ((dSeat + 1) % 2) as Seat;
	const dealerSeatVal = dSeat as Seat;

	const dealerStacks: Card[][] = [[], [], [], []];
	const nonDealerStacks: Card[][] = [[], [], [], []];

	let deckIdx = 0;
	for (let pass = 0; pass < 5; pass++) {
		for (let s = 0; s < 4; s++) {
			const nonDealerCard = remainingDeck[deckIdx++];
			if (nonDealerCard) nonDealerStacks[s]?.push(nonDealerCard);

			const dealerCard = remainingDeck[deckIdx++];
			if (dealerCard) dealerStacks[s]?.push(dealerCard);
		}
	}

	return {
		[nonDealerSeat]: buildPlayerStacks(nonDealerStacks),
		[dealerSeatVal]: buildPlayerStacks(dealerStacks),
	} as Record<Seat, PlayerStack[]>;
}

/**
 * Check follow-suit rule in 2-Player mode:
 * Considers both hand cards AND currently face-up stack cards.
 */
export function validate2PFollowSuit({
	hand,
	stacks,
	cardToPlay,
	leadSuit,
}: {
	hand: readonly Card[];
	stacks: readonly PlayerStack[];
	cardToPlay: Card;
	leadSuit: Suit | null;
}): boolean {
	if (!leadSuit) return true;
	if (parseCard(cardToPlay).suit === leadSuit) return true;

	const hasLeadSuitInHand = hand.some((c) => parseCard(c).suit === leadSuit);
	const hasLeadSuitInStacks = stacks.some((s) => s.faceUpCard && parseCard(s.faceUpCard).suit === leadSuit);

	return !hasLeadSuitInHand && !hasLeadSuitInStacks;
}

/**
 * Determine winner of a completed 2-Player trick.
 * Returns the winning player's seat.
 */
export function resolve2PTrickWinner(options: { trick: Trick; currentTurup: Suit | null }): Seat {
	const { trick, currentTurup } = options;
	const card1 = trick.cards[0];
	const card2 = trick.cards[1];

	if (!card1 || !card2) {
		throw new Error("Trick requires 2 cards to resolve winner");
	}

	const card1Suit = parseCard(card1.card).suit;
	const card2Suit = parseCard(card2.card).suit;
	const leadSuit = trick.leadSuit ?? card1Suit;

	if (card1Suit === currentTurup && card2Suit !== currentTurup) {
		return card1.seat;
	}

	if (card2Suit === currentTurup && card1Suit !== currentTurup) {
		return card2.seat;
	}

	if (card1Suit === currentTurup && card2Suit === currentTurup) {
		return compareCardRanks(card1.card, card2.card) >= 0 ? card1.seat : card2.seat;
	}

	// Neither is Turup
	if (card2Suit === leadSuit && card1Suit === leadSuit) {
		return compareCardRanks(card1.card, card2.card) >= 0 ? card1.seat : card2.seat;
	}

	if (card1Suit === leadSuit && card2Suit !== leadSuit) {
		return card1.seat;
	}

	return card1.seat;
}

/**
 * Get remaining undealt cards in 2-Player mode after hands are dealt.
 */
export function getRemainingCards2P(
	handsOrState: Record<Seat, readonly Card[]> | { hands: Record<Seat, readonly Card[]> },
	originalDeck?: readonly Card[],
): Card[] {
	const hands = "hands" in handsOrState ? handsOrState.hands : handsOrState;
	const handCards = new Set<Card>([...(hands[0 as Seat] ?? []), ...(hands[1 as Seat] ?? [])]);

	const baseDeck = originalDeck && originalDeck.length === 52 ? originalDeck : createDeck();
	return baseDeck.filter((c) => !handCards.has(c));
}
