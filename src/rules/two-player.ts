import { compareCardRanks } from "../cards/deck";
import type { Card, Player, PlayerStack2P, Suit, Trick } from "../types/index";

/**
 * 2-Player initial deal:
 * 6 cards to opponent (non-dealer), 6 cards to dealer.
 */
export function dealTwoPlayerInitial(
	deck: readonly Card[],
	dealerIndex: number,
	players: readonly Player[],
): { hands: Record<string, Card[]>; remainingDeck: Card[] } {
	if (players.length !== 2) {
		throw new Error(
			`2-Player mode requires exactly 2 players, got ${players.length}`,
		);
	}

	const nonDealerIndex = (dealerIndex + 1) % 2;
	const nonDealer = players[nonDealerIndex];
	const dealer = players[dealerIndex];

	if (!nonDealer || !dealer) {
		throw new Error("Invalid player list for 2-Player deal");
	}

	const nonDealerHand = deck.slice(0, 6);
	const dealerHand = deck.slice(6, 12);
	const remainingDeck = deck.slice(12);

	return {
		hands: {
			[nonDealer.id]: nonDealerHand,
			[dealer.id]: dealerHand,
		},
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
export function create2PStacks(
	remainingDeck: readonly Card[],
	players: readonly Player[],
	dealerIndex = 0,
): Record<string, PlayerStack2P[]> {
	if (players.length !== 2) {
		throw new Error(
			`2-Player mode requires exactly 2 players, got ${players.length}`,
		);
	}

	const nonDealerIndex = (dealerIndex + 1) % 2;
	const nonDealer = players[nonDealerIndex];
	const dealer = players[dealerIndex];

	if (!nonDealer || !dealer) {
		throw new Error("Invalid player list for 2-Player stack creation");
	}

	const rawNonDealerStacks: Card[][] = [[], [], [], []];
	const rawDealerStacks: Card[][] = [[], [], [], []];

	let deckIdx = 0;

	// 5 passes to place 5 cards per stack across 8 stacks
	for (let pass = 0; pass < 5; pass++) {
		for (let s = 0; s < 4; s++) {
			const c1 = remainingDeck[deckIdx];
			if (c1) rawNonDealerStacks[s].push(c1);
			deckIdx++;

			const c2 = remainingDeck[deckIdx];
			if (c2) rawDealerStacks[s].push(c2);
			deckIdx++;
		}
	}

	const buildStacks = (rawStacks: Card[][]): PlayerStack2P[] => {
		return rawStacks.map((cards, sIdx) => {
			const hidden = cards.slice(0, -1);
			const topCard = cards[cards.length - 1];
			return {
				id: `stack-${sIdx}`,
				position: sIdx,
				hiddenCards: hidden,
				faceUpCard: topCard ?? null,
			};
		});
	};

	return {
		[nonDealer.id]: buildStacks(rawNonDealerStacks),
		[dealer.id]: buildStacks(rawDealerStacks),
	};
}

/**
 * Validate follow-suit in 2-Player mode.
 * Must check both hand AND face-up stacks for player.
 */
export function validate2PFollowSuit(
	hand: readonly Card[],
	stacks: readonly PlayerStack2P[],
	cardToPlay: Card,
	leadSuit: Suit | null,
): boolean {
	if (!leadSuit) return true;
	if (cardToPlay.suit === leadSuit) return true;

	const hasInHand = hand.some((c) => c.suit === leadSuit);
	if (hasInHand) return false;

	const hasInStacks = stacks.some((s) => s.faceUpCard?.suit === leadSuit);
	if (hasInStacks) return false;

	return true;
}

/**
 * Resolve winner of a completed 2-Player trick.
 */
export function resolve2PTrickWinner(options: {
	trick: Trick;
	currentTurup: Suit | null;
}): string {
	const { trick, currentTurup } = options;
	if (trick.cards.length !== 2) {
		throw new Error("2P trick must have exactly 2 cards");
	}

	const card0 = trick.cards[0];
	const card1 = trick.cards[1];

	if (!card0 || !card1) {
		throw new Error("Invalid 2P trick cards");
	}

	const leadSuit = trick.leadSuit;

	if (currentTurup) {
		if (card0.card.suit === currentTurup && card1.card.suit !== currentTurup) {
			return card0.playerId;
		}
		if (card1.card.suit === currentTurup && card0.card.suit !== currentTurup) {
			return card1.playerId;
		}
		if (card0.card.suit === currentTurup && card1.card.suit === currentTurup) {
			return compareCardRanks(card0.card, card1.card) > 0
				? card0.playerId
				: card1.playerId;
		}
	}

	if (leadSuit) {
		if (card0.card.suit === leadSuit && card1.card.suit !== leadSuit) {
			return card0.playerId;
		}
		if (card1.card.suit === leadSuit && card0.card.suit !== leadSuit) {
			return card1.playerId;
		}
		if (card0.card.suit === leadSuit && card1.card.suit === leadSuit) {
			return compareCardRanks(card0.card, card1.card) > 0
				? card0.playerId
				: card1.playerId;
		}
	}

	return card0.playerId;
}
