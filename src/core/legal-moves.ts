import type { Card, GameState, Seat } from "../types/index";
import { parseCard } from "./card";
import { GAME_MODES } from "./const";
import { getCurrentTurnPlayer } from "./turn";
import { hasDealtStacks2P } from "./rules/two-player";

export interface LegalPlayableCard {
	readonly card: Card;
	readonly stackPosition?: number;
}

/**
 * Get legal playable cards for 4-Player mode.
 */
export function getLegalMoves4P(state: GameState, seat: Seat): LegalPlayableCard[] {
	const hand = state.hands[seat] ?? [];
	if (hand.length === 0) return [];

	const currentTurnPlayer = getCurrentTurnPlayer(state);
	if (currentTurnPlayer?.seat !== seat) return [];

	const availableCards: LegalPlayableCard[] = hand.map((card) => ({ card }));

	// 1. Ghopte Round (if unresolved ghoptes exist)
	const hasUnresolvedGhopte = state.ghoptes.some((g) => !g.resolved);
	if (hasUnresolvedGhopte) {
		const activeGhopte = state.ghoptes.find((g) => !g.resolved);

		// If current player is the Ghopte declarer, they play their Ghopte 10
		if (activeGhopte && activeGhopte.seat === seat) {
			const ghopteCard = hand.find((c) => c === activeGhopte.card);
			if (ghopteCard) {
				return [{ card: ghopteCard }];
			}
		}

		// Find any pending Ghopte cards owned by this player for future Ghopte rounds
		const pendingOwnGhopteIds = state.ghoptes.filter((g) => g.seat === seat && !g.resolved).map((g) => g.card);

		// Other players are guessing the face-down Ghopte card: any card from hand EXCEPT their own pending Ghopte 10s
		const guessingMoves = availableCards.filter((item) => !pendingOwnGhopteIds.includes(item.card));

		return guessingMoves.length > 0 ? guessingMoves : availableCards;
	}

	// 2. Standard Playing Phase (4P)
	const leadSuit = state.trick.leadSuit;
	if (!leadSuit) {
		return availableCards;
	}

	const matchingLeadSuit = availableCards.filter((item) => parseCard(item.card).suit === leadSuit);

	if (matchingLeadSuit.length > 0) {
		return matchingLeadSuit;
	}

	// Void in lead suit: can play any card
	return availableCards;
}

/**
 * Get legal playable cards for 2-Player mode.
 */
export function getLegalMoves2P(state: GameState, seat: Seat): LegalPlayableCard[] {
	// Must declare Turup first before normal trick play
	if (state.game.turup === null) {
		return [];
	}

	if (!hasDealtStacks2P(state)) {
		return [];
	}

	const hand = state.hands[seat] ?? [];
	const stacks = state.stacks[seat] ?? [];
	if (hand.length === 0 && stacks.every((s) => !s.faceUpCard && s.hiddenCards.length === 0)) {
		return [];
	}

	const currentTurnPlayer = getCurrentTurnPlayer(state);
	if (currentTurnPlayer?.seat !== seat) return [];

	const leadSuit = state.trick.leadSuit;

	const availableCards: LegalPlayableCard[] = [];

	// Hand cards
	for (const card of hand) {
		availableCards.push({ card });
	}

	// Face-up stack cards
	stacks.forEach((stack, idx) => {
		if (stack.faceUpCard) {
			availableCards.push({
				card: stack.faceUpCard,
				stackPosition: idx,
			});
		}
	});

	if (!leadSuit) {
		return availableCards;
	}

	const matchingLeadSuit = availableCards.filter((item) => parseCard(item.card).suit === leadSuit);

	if (matchingLeadSuit.length > 0) {
		return matchingLeadSuit;
	}

	// Void in lead suit: can play any card
	return availableCards;
}

/**
 * Main getLegalMoves dispatcher.
 */
export function getLegalMoves(state: GameState, seat: Seat): LegalPlayableCard[] {
	if (state.game.mode === GAME_MODES.FOUR_PLAYER) {
		return getLegalMoves4P(state, seat);
	}
	return getLegalMoves2P(state, seat);
}
