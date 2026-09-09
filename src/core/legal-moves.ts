import type { Card, GameState, PlayerPosition } from "../types/index";
import { parseCard } from "./card";
import { GAME_MODES, GAME_PHASES } from "./const";
import { getCurrentTurnPlayer } from "./turn";

export interface LegalPlayableCard {
	readonly card: Card;
	readonly stackPosition?: number;
}

/**
 * Get legal playable cards for 4-Player mode.
 */
export function getLegalMoves4P(state: GameState, playerPosition: PlayerPosition): LegalPlayableCard[] {
	if (state.game.phase !== GAME_PHASES.PLAYING && state.game.phase !== GAME_PHASES.GHOPTE) {
		return [];
	}

	const currentTurnPlayer = getCurrentTurnPlayer(state);
	if (currentTurnPlayer?.position !== playerPosition) return [];

	const hand = state.hands[playerPosition] ?? [];
	const availableCards: LegalPlayableCard[] = hand.map((card) => ({ card }));

	// 1. Ghopte Phase
	if (state.game.phase === GAME_PHASES.GHOPTE && state.ghoptes.length > 0) {
		const activeGhopte = state.ghoptes.find((g) => !g.resolved);

		// If current player is the Ghopte declarer, they play their Ghopte 10
		if (activeGhopte && activeGhopte.playerPosition === playerPosition) {
			const ghopteCard = hand.find((c) => c === activeGhopte.card);
			if (ghopteCard) {
				return [{ card: ghopteCard }];
			}
		}

		// Find any pending Ghopte cards owned by this player for future Ghopte rounds
		const pendingOwnGhopteIds = state.ghoptes
			.filter((g) => g.playerPosition === playerPosition && !g.resolved)
			.map((g) => g.card);

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
export function getLegalMoves2P(state: GameState, playerPosition: PlayerPosition): LegalPlayableCard[] {
	if (state.game.phase !== GAME_PHASES.PLAYING) {
		return [];
	}

	const currentTurnPlayer = getCurrentTurnPlayer(state);
	if (currentTurnPlayer?.position !== playerPosition) return [];

	const hand = state.hands[playerPosition] ?? [];
	const stacks = state.stacks[playerPosition] ?? [];
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
export function getLegalMoves(state: GameState, playerPosition: PlayerPosition): LegalPlayableCard[] {
	if (state.game.mode === GAME_MODES.FOUR_PLAYER) {
		return getLegalMoves4P(state, playerPosition);
	}
	return getLegalMoves2P(state, playerPosition);
}
