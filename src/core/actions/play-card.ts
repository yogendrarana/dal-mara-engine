import { parseCard } from "../card";
import { getCurrentTurnPlayer } from "../turn";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES } from "../const";
import { validateFollowSuit, resolve4PTrickWinner } from "../rules/four-player";
import { validate2PFollowSuit, resolve2PTrickWinner, hasDealtStacks2P } from "../rules/two-player";
import type { Card, GameState, PlayCardAction, PlayedCard, Seat, Trick, ValidationResult } from "../../types/index";

// Validation

export function validatePlayCard({ state, action }: { state: GameState; action: PlayCardAction }): ValidationResult {
	const currentTurnPlayer = getCurrentTurnPlayer(state);
	const { seat, card } = action.payload;

	if (state.ghoptes.some((g) => !g.resolved)) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Cannot play card while there are unresolved Ghoptes");
	}

	const notDealt = state.moveNumber === 0 && Object.values(state.hands).every((h) => h.length === 0);
	if (notDealt) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Cannot play cards before cards are dealt");
	}

	if (state.game.mode === GAME_MODES.TWO_PLAYER) {
		if (state.game.turup === null) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Cannot play cards before Turup is declared");
		}
		if (!hasDealtStacks2P(state)) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Cannot play cards before stacks are dealt");
		}
	}

	const allHandsEmpty = Object.values(state.hands).every((h) => h.length === 0);
	const allStacksEmpty =
		state.game.mode === GAME_MODES.TWO_PLAYER
			? Object.values(state.stacks).every((pStacks) => pStacks.every((s) => !s.faceUpCard && s.hiddenCards.length === 0))
			: true;
	if (allHandsEmpty && allStacksEmpty) {
		return createValidationError(ENGINE_ERROR_CODES.GAME_ALREADY_FINISHED, "Cannot play cards after game has ended");
	}

	if (currentTurnPlayer?.seat !== seat) {
		return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, `Not turn for player at seat ${seat}`);
	}

	const player = state.players.find((p) => p.seat === seat);
	if (!player) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Player not found");
	}

	const hand = state.hands[seat] ?? [];
	const stacks = state.stacks[seat] ?? [];

	let cardToPlay: Card | null = null;

	if (state.game.mode === GAME_MODES.TWO_PLAYER) {
		// first, search the card in hand
		cardToPlay = hand.find((c) => c === card) ?? null;

		// if card is not found then search among the stack
		if (!cardToPlay) {
			const matchingStack = stacks.find((s) => s.faceUpCard === card);
			if (matchingStack?.faceUpCard) {
				cardToPlay = matchingStack.faceUpCard;
			}
		}
	} else {
		cardToPlay = hand.find((c) => c === card) ?? null;
	}

	if (!cardToPlay) {
		return createValidationError(ENGINE_ERROR_CODES.CARD_NOT_OWNED, `Player does not own or cannot access card ${card}`);
	}

	// follow-suit validation for standard trick play
	const leadSuit = state.trick.leadSuit;

	if (state.game.mode === GAME_MODES.FOUR_PLAYER) {
		const followsSuit = validateFollowSuit({ hand, cardToPlay, leadSuit });

		if (!followsSuit) {
			return createValidationError(
				ENGINE_ERROR_CODES.MUST_FOLLOW_SUIT,
				`Must follow lead suit (${leadSuit}) when holding matching cards`,
			);
		}
	}

	if (state.game.mode === GAME_MODES.TWO_PLAYER) {
		const followsSuit = validate2PFollowSuit({
			hand,
			stacks,
			cardToPlay,
			leadSuit,
		});

		if (!followsSuit) {
			return createValidationError(
				ENGINE_ERROR_CODES.MUST_FOLLOW_SUIT,
				`Must follow lead suit (${leadSuit}) when holding matching cards in hand or face-up stacks`,
			);
		}
	}

	return { success: true };
}

// Reducer (4-Player)

export function reducePlayCard4P(state: GameState, action: PlayCardAction): GameState {
	const { seat, card } = action.payload;

	const currentPlayer = state.players.find((p) => p.seat === seat);
	if (!currentPlayer) return state;
	const playerSeat = currentPlayer.seat;

	const hand = state.hands[playerSeat];
	if (!hand) return state;

	const playedCardObj = hand.find((c) => c === card);
	if (!playedCardObj) return state;

	const updatedHands = {
		...state.hands,
		[playerSeat]: hand.filter((c) => c !== card),
	};

	const playedCardItem: PlayedCard = {
		seat: playerSeat,
		card: playedCardObj,
		playOrder: state.trick.cards.length + 1,
	};

	const cardSuit = parseCard(playedCardObj).suit;
	const isLead = state.trick.cards.length === 0;
	const currentTrickLeadSuit = isLead ? cardSuit : state.trick.leadSuit;

	let newTurup = state.game.turup;

	// Turup Creation & Override Logic (within the same trick):
	const trickHasOffSuitCard = state.trick.cards.some((pc) => parseCard(pc.card).suit !== state.trick.leadSuit);
	const turupFromPastTrick = state.game.turup !== null && !trickHasOffSuitCard;

	if (!turupFromPastTrick) {
		const isOffSuit = cardSuit !== currentTrickLeadSuit;
		if (isOffSuit) {
			if (!newTurup) {
				// First time turup is created in this trick
				newTurup = cardSuit;
			} else if (newTurup !== cardSuit) {
				// Turup was created in this same trick. Check if player can override it.
				const playerHand = updatedHands[playerSeat] ?? [];
				const hasExistingTurupInHand = playerHand.some((c) => parseCard(c).suit === newTurup);
				if (!hasExistingTurupInHand) {
					newTurup = cardSuit;
				}
			}
		}
	}

	const makesTurup = newTurup !== state.game.turup && newTurup === cardSuit;
	const newMoveNumber = state.moveNumber + 1;

	const updatedTrickCards = [...state.trick.cards, playedCardItem];
	const isTrickComplete = updatedTrickCards.length === 4;

	const currentTrickSnapshot: Trick = {
		number: state.trick.number,
		playNumber: updatedTrickCards.length,
		leadSuit: currentTrickLeadSuit,
		isGhopte: false,
		cards: updatedTrickCards,
	};

	// if trick is completed
	if (isTrickComplete) {
		const winnerPos = resolve4PTrickWinner({
			trick: currentTrickSnapshot,
			currentTurup: newTurup,
		});

		// Check if game is finished (all hands empty after this play)
		const allHandsEmpty = Object.values(updatedHands).every((h) => h.length === 0);

		if (allHandsEmpty) {
			return {
				...state,
				game: {
					...state.game,
					turup: newTurup,
				},
				hands: updatedHands,
				moveNumber: newMoveNumber,
				moveDetail: {
					seat: playerSeat,
					card: playedCardObj,
					makesTurup,
				},
				trick: {
					number: state.trick.number,
					playNumber: 4,
					leadSuit: currentTrickLeadSuit,
					isGhopte: false,
					cards: [],
				},
				nextMoveSeat: winnerPos,
			};
		}

		return {
			...state,
			game: {
				...state.game,
				turup: newTurup,
			},
			hands: updatedHands,
			moveNumber: newMoveNumber,
			moveDetail: {
				seat: playerSeat,
				card: playedCardObj,
				makesTurup,
			},
			trick: {
				number: state.trick.number + 1,
				playNumber: 0,
				leadSuit: null,
				isGhopte: false,
				cards: [],
			},
			nextMoveSeat: winnerPos,
		};
	}

	// trick not complete: advance turn to next player
	const nextSeat = ((playerSeat + 1) % 4) as Seat;

	return {
		...state,
		game: {
			...state.game,
			turup: newTurup,
		},
		hands: updatedHands,
		moveNumber: newMoveNumber,
		moveDetail: {
			seat: playerSeat,
			card: playedCardObj,
			makesTurup,
		},
		trick: currentTrickSnapshot,
		nextMoveSeat: nextSeat,
	};
}

// Reducer (2-Player)

export function reducePlayCard2P(state: GameState, action: PlayCardAction): GameState {
	const { seat, card } = action.payload;

	const currentPlayer = state.players.find((p) => p.seat === seat);
	if (!currentPlayer) return state;
	const playerSeat = currentPlayer.seat;

	let playedCardObj: Card | null = null;
	const updatedHands = { ...state.hands };
	const updatedStacks = { ...state.stacks };
	const playerStacks = [...(updatedStacks[playerSeat] ?? [])];

	// 1. Play from stack if card belongs to stack
	const targetStackIndex = playerStacks.findIndex((s) => s.faceUpCard === card);
	if (targetStackIndex >= 0 && targetStackIndex < playerStacks.length) {
		const stack = playerStacks[targetStackIndex];
		if (stack?.faceUpCard && stack.faceUpCard === card) {
			playedCardObj = stack.faceUpCard;
			const newHidden = [...stack.hiddenCards];
			const nextFaceUp = newHidden.pop() ?? null;

			playerStacks[targetStackIndex] = {
				...stack,
				hiddenCards: newHidden,
				faceUpCard: nextFaceUp,
			};

			updatedStacks[playerSeat] = playerStacks;
		}
	}

	// 2. Play from hand if not played from stack
	if (!playedCardObj) {
		const hand = updatedHands[playerSeat] ?? [];
		playedCardObj = hand.find((c) => c === card) ?? null;

		if (playedCardObj) {
			updatedHands[playerSeat] = hand.filter((c) => c !== card);
		}
	}

	// If card to play is not owned or invalid, return state directly
	if (!playedCardObj) return state;

	const playedCardItem: PlayedCard = {
		seat: playerSeat,
		card: playedCardObj,
		playOrder: state.trick.cards.length + 1,
	};

	const cardSuit = parseCard(playedCardObj).suit;
	const isLead = state.trick.cards.length === 0;
	const currentTrickLeadSuit = isLead ? cardSuit : state.trick.leadSuit;

	const newMoveNumber = state.moveNumber + 1;

	const currentTrickCards = [...state.trick.cards, playedCardItem];
	const isTrickComplete = currentTrickCards.length === 2;

	const currentTrickSnapshot: Trick = {
		number: state.trick.number,
		playNumber: currentTrickCards.length,
		leadSuit: currentTrickLeadSuit,
		isGhopte: false,
		cards: currentTrickCards,
	};

	if (isTrickComplete) {
		const winnerPos = resolve2PTrickWinner({
			trick: currentTrickSnapshot,
			currentTurup: state.game.turup,
		});

		// Check if game is finished
		const allHandsEmpty = Object.values(updatedHands).every((h) => h.length === 0);
		const allStacksEmpty = Object.values(updatedStacks).every((pStacks) =>
			pStacks.every((s) => !s.faceUpCard && s.hiddenCards.length === 0),
		);
		const finished = allHandsEmpty && allStacksEmpty;

		if (finished) {
			return {
				...state,
				hands: updatedHands,
				stacks: updatedStacks,
				moveNumber: newMoveNumber,
				moveDetail: {
					seat: playerSeat,
					card: playedCardObj,
					makesTurup: false,
				},
				trick: {
					number: state.trick.number,
					playNumber: 2,
					leadSuit: currentTrickLeadSuit,
					isGhopte: false,
					cards: [],
				},
				nextMoveSeat: winnerPos,
			};
		}

		return {
			...state,
			hands: updatedHands,
			stacks: updatedStacks,
			moveNumber: newMoveNumber,
			moveDetail: {
				seat: playerSeat,
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
			nextMoveSeat: winnerPos,
		};
	}

	// Trick not complete: advance turn to other player
	const nextSeat = ((playerSeat + 1) % 2) as Seat;

	return {
		...state,
		hands: updatedHands,
		stacks: updatedStacks,
		moveNumber: newMoveNumber,
		moveDetail: {
			seat: playerSeat,
			card: playedCardObj,
			makesTurup: false,
		},
		trick: currentTrickSnapshot,
		nextMoveSeat: nextSeat,
	};
}
