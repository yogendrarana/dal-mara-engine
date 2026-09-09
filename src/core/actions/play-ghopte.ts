import { parseCard } from "../card";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES } from "../const";
import { resolve4PTrickWinner } from "../rules/four-player";
import { getCurrentTurnPlayer } from "../turn";
import type { GameState, PlayedCard, PlayerPosition, PlayGhopteAction, Trick, ValidationResult } from "../../types/index";

// Validation

export function validatePlayGhopte({ state, action }: { state: GameState; action: PlayGhopteAction }): ValidationResult {
	const currentTurnPlayer = getCurrentTurnPlayer(state);
	const { playerPosition, card } = action.payload;

	if (state.game.mode !== GAME_MODES.FOUR_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Ghopte is only valid in 4-Player mode");
	}

	if (state.game.phase !== GAME_PHASES.GHOPTE) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "PLAY_GHOPTE action is only valid during GHOPTE phase");
	}

	if (currentTurnPlayer?.position !== playerPosition) {
		return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, `Not turn for player at position ${playerPosition}`);
	}

	const player = state.players.find((p) => p.position === playerPosition);
	if (!player) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Player not found");
	}

	const hand = state.hands[playerPosition] ?? [];
	const cardToPlay = hand.find((c) => c === card) ?? null;

	if (!cardToPlay) {
		return createValidationError(ENGINE_ERROR_CODES.CARD_NOT_OWNED, `Player does not own card ${card}`);
	}

	if (state.ghoptes.length > 0) {
		const activeGhopte = state.ghoptes.find((g) => !g.resolved);

		if (!activeGhopte) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION, "Active ghopte is not found.");
		}

		const isPlayerGhopteDeclarer = activeGhopte.playerPosition === playerPosition;

		if (isPlayerGhopteDeclarer) {
			if (cardToPlay !== activeGhopte.card) {
				return createValidationError(
					ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION,
					"Declarer must play the declared Ghopte 10 card",
				);
			}
		}

		if (!isPlayerGhopteDeclarer) {
			// player cannot throw their own pending Ghopte 10 for another player's Ghopte
			const isPendingOwnGhopte = state.ghoptes.some(
				(g) => g.playerPosition === playerPosition && !g.resolved && g.card === cardToPlay,
			);

			if (isPendingOwnGhopte) {
				return createValidationError(
					ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION,
					"Cannot play your own pending Ghopte 10 card while guessing another player's Ghopte",
				);
			}
		}
	}

	return { success: true };
}

// Reducer (4-Player only)

export function reducePlayGhopte4P(state: GameState, action: PlayGhopteAction): GameState {
	const { playerPosition, card } = action.payload;

	const currentPlayer = state.players.find((p) => p.position === playerPosition);
	if (!currentPlayer) return state;
	const playerPos = currentPlayer.position;

	const hand = state.hands[playerPos];
	if (!hand) return state;

	const playedCardObj = hand.find((c) => c === card);
	if (!playedCardObj) return state;

	const updatedHands = {
		...state.hands,
		[playerPos]: hand.filter((c) => c !== card),
	};

	const playedCardItem: PlayedCard = {
		playerPosition: playerPos,
		card: playedCardObj,
		playOrder: state.trick.cards.length + 1,
	};

	if (state.game.phase !== GAME_PHASES.GHOPTE || state.ghoptes.length === 0) return state;

	const currentGhopte = state.ghoptes.find((g) => !g.resolved);
	if (!currentGhopte) return state;

	const targetSuit = parseCard(currentGhopte.card).suit;
	const isLead = state.trick.cards.length === 0;
	const currentTrickLeadSuit = isLead ? targetSuit : state.trick.leadSuit;

	const updatedTrickCards = [...state.trick.cards, playedCardItem];
	const isTrickComplete = updatedTrickCards.length === 4;
	const newMoveNumber = state.moveNumber + 1;

	const currentTrickSnapshot: Trick = {
		number: state.trick.number,
		playNumber: updatedTrickCards.length,
		leadSuit: currentTrickLeadSuit,
		isGhopte: true,
		cards: updatedTrickCards,
	};

	if (isTrickComplete) {
		const winnerPos = resolve4PTrickWinner({
			trick: currentTrickSnapshot,
			currentTurup: null,
		});

		// Mark current Ghopte as resolved
		const updatedGhoptes = state.ghoptes.map((g) => (g.order === currentGhopte.order ? { ...g, resolved: true } : g));

		const nextGhopte = updatedGhoptes.find((g) => !g.resolved);
		const hasMoreGhoptes = !!nextGhopte;

		if (hasMoreGhoptes && nextGhopte) {
			const nextSuit = parseCard(nextGhopte.card).suit;

			return {
				...state,
				hands: updatedHands,
				ghoptes: updatedGhoptes,
				moveNumber: newMoveNumber,
				moveDetail: {
					playerPosition: playerPos,
					card: playedCardObj,
					makesTurup: false,
				},
				trick: {
					number: state.trick.number + 1,
					playNumber: 0,
					leadSuit: nextSuit,
					isGhopte: true,
					cards: [],
				},
				nextMovePlayerPosition: nextGhopte.playerPosition,
			};
		}

		// All Ghoptes resolved! Transition to PLAYING phase.
		return {
			...state,
			game: {
				...state.game,
				phase: GAME_PHASES.PLAYING,
			},
			hands: updatedHands,
			ghoptes: updatedGhoptes,
			moveNumber: newMoveNumber,
			moveDetail: {
				playerPosition: playerPos,
				card: playedCardObj,
				makesTurup: false,
			},
			trick: {
				number: state.trick.number + 1,
				playNumber: 0,
				leadSuit: null,
				isGhopte: false,
				cards: [],
			},
			nextMovePlayerPosition: winnerPos,
		};
	}

	// Ghopte trick in progress: advance turn to next player
	const nextPos = ((playerPos + 1) % 4) as PlayerPosition;

	return {
		...state,
		hands: updatedHands,
		moveNumber: newMoveNumber,
		moveDetail: {
			playerPosition: playerPos,
			card: playedCardObj,
			makesTurup: false,
		},
		trick: currentTrickSnapshot,
		nextMovePlayerPosition: nextPos,
	};
}
