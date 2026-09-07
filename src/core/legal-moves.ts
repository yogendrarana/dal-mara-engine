import type { Card, GameState } from "../types/index";
import { parseCard } from "./card";
import { GAME_MODES, GAME_PHASES, RANKS } from "./const";
import { getCurrentTurnPlayer } from "./turn";

export interface LegalPlayableCard {
	readonly card: Card;
	readonly stackPosition?: number;
}

/**
 * Get legal playable cards for 4-Player mode.
 */
export function getLegalMoves4P(state: GameState, playerId: string): LegalPlayableCard[] {
	if (state.game.phase !== GAME_PHASES.PLAYING && state.game.phase !== GAME_PHASES.GHOPTE) {
		return [];
	}

	const currentTurnPlayer = getCurrentTurnPlayer(state);
	if (currentTurnPlayer?.id !== playerId) return [];

	const player = state.players.find((p) => p.id === playerId);
	const hand = state.hands[playerId] ?? [];
	const availableCards: LegalPlayableCard[] = hand.map((card) => ({ card }));

	// 1. Ghopte Phase
	if (state.game.phase === GAME_PHASES.GHOPTE && state.ghopteState) {
		const activeGhopte = state.ghopteState.ghoptes[state.ghopteState.activeIndex];

		// If current player is the Ghopte declarer, they play their Ghopte 10
		if (activeGhopte && activeGhopte.declarerPosition === player?.position) {
			const ghopteCard = hand.find((c) => {
				const details = parseCard(c);
				return details.suit === activeGhopte.suit && details.rank === RANKS.TEN;
			});
			if (ghopteCard) {
				return [{ card: ghopteCard }];
			}
		}

		// Find any pending Ghopte cards owned by this player for future Ghopte rounds
		const pendingOwnGhopteIds = state.ghopteState.ghoptes
			.filter((g) => g.declarerPosition === player?.position && !g.resolved)
			.map((g) => g.tenCard);

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
export function getLegalMoves2P(state: GameState, playerId: string): LegalPlayableCard[] {
	if (state.game.phase !== GAME_PHASES.PLAYING) {
		return [];
	}

	const currentTurnPlayer = getCurrentTurnPlayer(state);
	if (currentTurnPlayer?.id !== playerId) return [];

	const hand = state.hands[playerId] ?? [];
	const stacks = state.stacks2P[playerId] ?? [];
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
export function getLegalMoves(state: GameState, playerId: string): LegalPlayableCard[] {
	if (state.game.mode === GAME_MODES.FOUR_PLAYER) {
		return getLegalMoves4P(state, playerId);
	}
	return getLegalMoves2P(state, playerId);
}
