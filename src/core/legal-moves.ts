import type { Card, GameState } from "../types/index";
import { GAME_MODES, GAME_PHASES, RANKS } from "./const";

export interface LegalPlayableCard {
	readonly card: Card;
	readonly stackPosition?: number;
}

/**
 * Get legal playable cards for 4-Player mode.
 */
export function getLegalMoves4P(state: GameState, playerId: string): LegalPlayableCard[] {
	if (state.phase !== GAME_PHASES.PLAYING && state.phase !== GAME_PHASES.GHOPTE) {
		return [];
	}

	if (state.currentTurnPlayerId !== playerId) return [];

	const hand = state.hands[playerId] ?? [];
	const availableCards: LegalPlayableCard[] = hand.map((card) => ({ card }));

	// 1. Ghopte Phase
	if (state.phase === GAME_PHASES.GHOPTE && state.ghopteState) {
		const activeGhopte = state.ghopteState.ghoptes[state.ghopteState.activeIndex];

		// If current player is the Ghopte declarer, they play their Ghopte 10
		if (activeGhopte && activeGhopte.declarerId === playerId) {
			const ghopteCard = hand.find((c) => c.suit === activeGhopte.suit && c.rank === RANKS.TEN);
			if (ghopteCard) {
				return [{ card: ghopteCard }];
			}
		}

		// Find any pending Ghopte cards owned by this player for future Ghopte rounds
		const pendingOwnGhopteIds = state.ghopteState.ghoptes
			.filter((g) => g.declarerId === playerId && !g.resolved)
			.map((g) => g.tenCard.id);

		// Other players are guessing the face-down Ghopte card: any card from hand EXCEPT their own pending Ghopte 10s
		const guessingMoves = availableCards.filter((item) => !pendingOwnGhopteIds.includes(item.card.id));

		return guessingMoves.length > 0 ? guessingMoves : availableCards;
	}

	// 2. Standard Playing Phase (4P)
	const leadSuit = state.currentTrick.leadSuit;
	if (!leadSuit) {
		return availableCards;
	}

	const matchingLeadSuit = availableCards.filter((item) => item.card.suit === leadSuit);

	if (matchingLeadSuit.length > 0) {
		return matchingLeadSuit;
	}

	// Void in lead suit: can play any card
	return availableCards;
}

/**
 * Get legal playable cards for 2-Player mode.
 */
export function getLegalMoves2P(state: GameState, playerId: string): LegalPlayableCard[] {
	if (state.phase !== GAME_PHASES.PLAYING) {
		return [];
	}

	if (state.currentTurnPlayerId !== playerId) return [];

	const hand = state.hands[playerId] ?? [];
	const stacks = state.stacks2P[playerId] ?? [];
	const leadSuit = state.currentTrick.leadSuit;

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

	const matchingLeadSuit = availableCards.filter((item) => item.card.suit === leadSuit);

	if (matchingLeadSuit.length > 0) {
		return matchingLeadSuit;
	}

	// Void in lead suit: can play any card
	return availableCards;
}

/**
 * Main getLegalMoves dispatcher.
 */
export function getLegalMoves(state: GameState, playerId: string): LegalPlayableCard[] {
	if (state.mode === GAME_MODES.FOUR_PLAYER) {
		return getLegalMoves4P(state, playerId);
	}
	return getLegalMoves2P(state, playerId);
}
