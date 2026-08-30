import { compareCardRanks } from "../deck";
import { GHOPTE_RESOLUTION_ORDER, RANKS, SUITS } from "../const";
import type {
	Card,
	GhopteInfo,
	GhopteResolutionOrder,
	GhopteState,
	PlayedCard,
	Player,
	PlayerPosition,
	Suit,
	Trick,
} from "../../types/index";

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
 *
 * @param pos
 * @returns
 */
const getPlayerIdByPos = ({ position, players }: { position: number; players: readonly Player[] }): string => {
	const p = players.find((pl) => pl.position === position);

	if (!p) {
		throw new Error(`Player position ${position} not found in player list`);
	}
	return p.id;
};

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
	players,
}: {
	deck: readonly Card[];
	dealerPosition: number;
	players: readonly Player[];
}): Record<string, Card[]> {
	// initialize empty hands
	const hands: Record<string, Card[]> = {};
	for (const player of players) {
		hands[player.id] = [];
	}

	let deckIndex = 0;
	const startPos = getFirstPlayerPosition({ dealerPosition, totalPlayers: 4 });

	// deal pass 1: 5 cards each
	let currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const pId = getPlayerIdByPos({ position: currPos, players });
		const targetHand = hands[pId];
		if (!targetHand) {
			throw new Error(`Hand not initialized for player ${pId}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 5));
		deckIndex += 5;
		currPos = getAnticlockwiseNextPosition(currPos, 4);
	}

	// deal pass 2: 4 cards each
	currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const pId = getPlayerIdByPos({ position: currPos, players });
		const targetHand = hands[pId];
		if (!targetHand) {
			throw new Error(`Hand not initialized for player ${pId}`);
		}
		targetHand.push(...deck.slice(deckIndex, deckIndex + 4));
		deckIndex += 4;
		currPos = getAnticlockwiseNextPosition(currPos, 4);
	}

	// deal pass 3: 4 cards each
	currPos = startPos;
	for (let i = 0; i < 4; i++) {
		const pId = getPlayerIdByPos({ position: currPos, players });
		const targetHand = hands[pId];
		if (!targetHand) {
			throw new Error(`Hand not initialized for player ${pId}`);
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
	hands = {},
	players = [],
	dealerPosition = 0,
	ghopteResolutionOrder,
}: {
	hands: Record<string, readonly Card[]>;
	players: readonly Player[];
	dealerPosition: number;
	ghopteResolutionOrder: GhopteResolutionOrder;
}): GhopteState | null {
	const playersList: readonly Player[] =
		players.length > 0
			? players
			: Object.keys(hands).map((id, index) => ({
					id,
					name: id,
					position: (index % 4) as PlayerPosition,
					team: index % 2 === 0 ? "team1" : "team2",
				}));

	const allGhoptes: GhopteInfo[] = [];

	const playerByPos: Record<number, Player> = {};
	for (const p of playersList) {
		playerByPos[p.position] = p;
	}

	const total = playersList.length;
	const startOffset = ghopteResolutionOrder === GHOPTE_RESOLUTION_ORDER.DEALER_LAST ? 1 : 0;

	for (let i = 0; i < total; i++) {
		const pos = (dealerPosition + startOffset + i) % total;

		const player = playerByPos[pos];
		if (!player) {
			continue;
		}

		const hand = hands[player.id] ?? [];
		const suitCounts: Record<Suit, Card[]> = {
			[SUITS.SPADES]: [],
			[SUITS.HEARTS]: [],
			[SUITS.DIAMONDS]: [],
			[SUITS.CLUBS]: [],
		};

		for (const card of hand) {
			suitCounts[card.suit].push(card);
		}

		for (const [suit, cards] of Object.entries(suitCounts)) {
			if (cards.length === 1) {
				const card = cards[0];

				if (card && card.rank === RANKS.TEN) {
					allGhoptes.push({
						order: allGhoptes.length,
						declarerId: player.id,
						suit: suit as Suit,
						tenCard: card,
						resolved: false,
					});
				}
			}
		}
	}

	if (allGhoptes.length === 0) {
		return null;
	}

	return {
		ghoptes: allGhoptes,
		activeIndex: 0,
	};
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
	if (cardToPlay.suit === leadSuit) return true;

	const hasLeadSuit = hand.some((c) => c.suit === leadSuit);
	return !hasLeadSuit;
}

/**
 * Determine winner of a completed 4-Player trick.
 * In 4P mode, active Turup is passed in `currentTurup`.
 */
export function resolve4PTrickWinner(options: { trick: Trick; currentTurup: Suit | null }): string {
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

		const currentCardSuit = current.card.suit;
		const winningCardSuit = winningPlayedCard.card.suit;

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

	return winningPlayedCard.playerId;
}
