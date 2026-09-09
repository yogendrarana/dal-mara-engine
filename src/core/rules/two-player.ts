import { compareCardRanks, parseCard } from "../card";
import type { Card, Player, PlayerPosition, PlayerStack, Suit, Trick } from "../../types/index";

/**
 * 2-Player initial deal:
 * 6 cards to opponent (non-dealer), 6 cards to dealer.
 */
export function dealTwoPlayer({ deck, dealerPosition }: { deck: readonly Card[]; dealerPosition: number }): {
	hands: Record<PlayerPosition, Card[]>;
	remainingDeck: Card[];
} {
	const nonDealerPosition = ((dealerPosition + 1) % 2) as PlayerPosition;
	const dealerPos = dealerPosition as PlayerPosition;

	const nonDealerHand = deck.slice(0, 6);
	const dealerHand = deck.slice(6, 12);
	const remainingDeck = deck.slice(12);

	return {
		hands: {
			[nonDealerPosition]: nonDealerHand,
			[dealerPos]: dealerHand,
		} as Record<PlayerPosition, Card[]>,
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
	dealerPosition,
}: {
	remainingDeck: readonly Card[];
	dealerPosition: number;
}): Record<PlayerPosition, PlayerStack[]> {
	const nonDealerPosition = ((dealerPosition + 1) % 2) as PlayerPosition;
	const dealerPos = dealerPosition as PlayerPosition;

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
		[nonDealerPosition]: buildPlayerStacks(nonDealerStacks),
		[dealerPos]: buildPlayerStacks(dealerStacks),
	} as Record<PlayerPosition, PlayerStack[]>;
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
 * Returns the winning player's position.
 */
export function resolve2PTrickWinner(options: { trick: Trick; currentTurup: Suit | null }): PlayerPosition {
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
		return card1.playerPosition;
	}

	if (card2Suit === currentTurup && card1Suit !== currentTurup) {
		return card2.playerPosition;
	}

	if (card1Suit === currentTurup && card2Suit === currentTurup) {
		return compareCardRanks(card1.card, card2.card) >= 0 ? card1.playerPosition : card2.playerPosition;
	}

	// Neither is Turup
	if (card2Suit === leadSuit && card1Suit === leadSuit) {
		return compareCardRanks(card1.card, card2.card) >= 0 ? card1.playerPosition : card2.playerPosition;
	}

	if (card1Suit === leadSuit && card2Suit !== leadSuit) {
		return card1.playerPosition;
	}

	return card1.playerPosition;
}
