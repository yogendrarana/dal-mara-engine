import { parseCard } from "../card";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES } from "../const";
import { validateFollowSuit, resolve4PTrickWinner } from "../rules/four-player";
import { validate2PFollowSuit, resolve2PTrickWinner } from "../rules/two-player";
import { createInitialScoreState, isGameFinished4P, isGameFinished2P, updateScoreOnTrickWon } from "../scoring/scoring";
import { getCurrentTurnPlayer } from "../turn";
import type { EventDispatcher } from "../../events/dispatcher";
import type { Card, GameState, PlayCardAction, PlayedCard, PlayerPosition, Trick, ValidationResult } from "../../types/index";

// Validation

export function validatePlayCard({ state, action }: { state: GameState; action: PlayCardAction }): ValidationResult {
	const currentTurnPlayer = getCurrentTurnPlayer(state);
	const { playerId, card } = action.payload;

	if (state?.ghopteState?.ghoptes.some((g) => !g.resolved)) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot play card while there are unresolved Ghoptes");
	}

	if (state.game.phase !== GAME_PHASES.PLAYING) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot play cards outside PLAYING phase");
	}

	if (currentTurnPlayer?.id !== playerId) {
		return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, `Not turn for player ${playerId}`);
	}

	const hand = state.hands[playerId] ?? [];
	const stacks = state.stacks2P[playerId] ?? [];

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

	// follow-suit validation for standard PLAYING phase
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
	const nextActions = [...state.actions, action];
	const { playerId, card } = action.payload;

	const hand = state.hands[playerId];
	if (!hand) return state;

	const playedCardObj = hand.find((c) => c === card);
	if (!playedCardObj) return state;

	const currentPlayer = state.players.find((p) => p.id === playerId);
	if (!currentPlayer) return state;
	const playerPos = currentPlayer.position;

	const updatedHands = {
		...state.hands,
		[playerId]: hand.filter((c) => c !== card),
	};

	const playedCardItem: PlayedCard = {
		playerId,
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
				const playerHand = updatedHands[playerId] ?? [];
				const hasExistingTurupInHand = playerHand.some((c) => parseCard(c).suit === newTurup);
				if (!hasExistingTurupInHand) {
					newTurup = cardSuit;
				}
			}
		}
	}

	const makesTurup = newTurup !== state.game.turup && newTurup === cardSuit;
	const isTurup = newTurup !== null && cardSuit === newTurup;
	const newPlayNumber = state.play.number + 1;

	const updatedTrickCards = [...state.trick.cards, playedCardItem];
	const isTrickComplete = updatedTrickCards.length === 4;

	const currentTrickSnapshot: Trick = {
		number: state.trick.number,
		playNumber: updatedTrickCards.length,
		leadSuit: currentTrickLeadSuit,
		leaderPosition: state.trick.leaderPosition,
		isGhopte: false,
		cards: updatedTrickCards,
		nextLeaderPosition: null,
		winnerPosition: null,
	};

	// if trick is completed
	if (isTrickComplete) {
		const winnerId = resolve4PTrickWinner({
			trick: currentTrickSnapshot,
			currentTurup: newTurup,
		});

		const winnerPlayer = state.players.find((p) => p.id === winnerId);
		if (!winnerPlayer) return state;
		const winnerPos = winnerPlayer.position;

		const completedTrick: Trick = {
			...currentTrickSnapshot,
			playNumber: 4,
			winnerPosition: winnerPos,
			nextLeaderPosition: winnerPos,
		};

		const currentScore = state.scoring.scores[winnerId] ?? createInitialScoreState();
		const updatedScore = updateScoreOnTrickWon({
			currentScore,
			trick: completedTrick,
		});

		const updatedScores = {
			...state.scoring.scores,
			[winnerId]: updatedScore,
		};

		const totalTricksPlayed = Object.values(updatedScores).reduce((sum, s) => sum + s.capturedTricksCount, 0);

		const finished = isGameFinished4P({
			totalTricksPlayed,
			hands: updatedHands,
		});

		if (finished) {
			return {
				...state,
				game: {
					...state.game,
					phase: GAME_PHASES.END,
					turup: newTurup,
				},
				hands: updatedHands,
				play: {
					number: newPlayNumber,
					card: playedCardObj,
					playerPosition: null,
					isGhopte: false,
					isTurup,
					makesTurup,
				},
				scoring: {
					scores: updatedScores,
				},
				trick: completedTrick,
				actions: nextActions,
			};
		}

		return {
			...state,
			game: {
				...state.game,
				turup: newTurup,
			},
			hands: updatedHands,
			play: {
				number: newPlayNumber,
				card: playedCardObj,
				playerPosition: winnerPos,
				isGhopte: false,
				isTurup,
				makesTurup,
			},
			scoring: {
				scores: updatedScores,
			},
			trick: {
				number: Math.min(totalTricksPlayed + 1, 13),
				playNumber: 1,
				leadSuit: null,
				leaderPosition: winnerPos,
				isGhopte: false,
				cards: [],
				nextLeaderPosition: null,
				winnerPosition: null,
			},
			actions: nextActions,
		};
	}

	// trick not complete: advance turn to next player
	const nextPos = ((playerPos + 1) % 4) as PlayerPosition;

	return {
		...state,
		game: {
			...state.game,
			turup: newTurup,
		},
		hands: updatedHands,
		play: {
			number: newPlayNumber,
			card: playedCardObj,
			playerPosition: nextPos,
			isGhopte: false,
			isTurup,
			makesTurup,
		},
		trick: {
			...currentTrickSnapshot,
			playNumber: updatedTrickCards.length + 1,
		},
		actions: nextActions,
	};
}

// Reducer (2-Player)

export function reducePlayCard2P(state: GameState, action: PlayCardAction): GameState {
	const nextActions = [...state.actions, action];
	const { playerId, card } = action.payload;

	let playedCardObj: Card | null = null;
	const updatedHands = { ...state.hands };
	const updatedStacks = { ...state.stacks2P };
	const playerStacks = [...(updatedStacks[playerId] ?? [])];

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

			updatedStacks[playerId] = playerStacks;
		}
	}

	// 2. Play from hand if not played from stack
	if (!playedCardObj) {
		const hand = updatedHands[playerId] ?? [];
		playedCardObj = hand.find((c) => c === card) ?? null;

		if (playedCardObj) {
			updatedHands[playerId] = hand.filter((c) => c !== card);
		}
	}

	// If card to play is not owned or invalid, return state directly
	if (!playedCardObj) return state;

	const currentPlayer = state.players.find((p) => p.id === playerId);
	if (!currentPlayer) return state;
	const playerPos = currentPlayer.position;

	const playedCardItem: PlayedCard = {
		playerId,
		card: playedCardObj,
		playOrder: state.trick.cards.length + 1,
	};

	const cardSuit = parseCard(playedCardObj).suit;
	const isLead = state.trick.cards.length === 0;
	const currentTrickLeadSuit = isLead ? cardSuit : state.trick.leadSuit;

	const isTurup = state.game.turup !== null && cardSuit === state.game.turup;
	const newPlayNumber = state.play.number + 1;

	const currentTrickCards = [...state.trick.cards, playedCardItem];
	const isTrickComplete = currentTrickCards.length === 2;

	const currentTrickSnapshot: Trick = {
		number: state.trick.number,
		playNumber: currentTrickCards.length,
		leadSuit: currentTrickLeadSuit,
		leaderPosition: state.trick.leaderPosition,
		isGhopte: false,
		cards: currentTrickCards,
		nextLeaderPosition: null,
		winnerPosition: null,
	};

	if (isTrickComplete) {
		const winnerId = resolve2PTrickWinner({
			trick: currentTrickSnapshot,
			currentTurup: state.game.turup,
		});

		const winnerPlayer = state.players.find((p) => p.id === winnerId);
		if (!winnerPlayer) return state;
		const winnerPos = winnerPlayer.position;

		const completedTrick: Trick = {
			...currentTrickSnapshot,
			playNumber: 2,
			winnerPosition: winnerPos,
			nextLeaderPosition: winnerPos,
		};

		const currentScore = state.scoring.scores[winnerId] ?? createInitialScoreState();
		const updatedScore = updateScoreOnTrickWon({
			currentScore,
			trick: completedTrick,
		});

		const updatedScores = {
			...state.scoring.scores,
			[winnerId]: updatedScore,
		};

		const totalTricksPlayed = Object.values(updatedScores).reduce((sum, s) => sum + s.capturedTricksCount, 0);

		const finished = isGameFinished2P({
			totalTricksPlayed,
			hands: updatedHands,
			stacks2P: updatedStacks,
		});

		if (finished) {
			return {
				...state,
				game: {
					...state.game,
					phase: GAME_PHASES.END,
				},
				hands: updatedHands,
				stacks2P: updatedStacks,
				play: {
					number: newPlayNumber,
					card: playedCardObj,
					playerPosition: null,
					isGhopte: false,
					isTurup,
					makesTurup: false,
				},
				scoring: {
					scores: updatedScores,
				},
				trick: completedTrick,
				actions: nextActions,
			};
		}

		return {
			...state,
			hands: updatedHands,
			stacks2P: updatedStacks,
			play: {
				number: newPlayNumber,
				card: playedCardObj,
				playerPosition: winnerPos,
				isGhopte: false,
				isTurup,
				makesTurup: false,
			},
			scoring: {
				scores: updatedScores,
			},
			trick: {
				number: Math.min(totalTricksPlayed + 1, 26),
				playNumber: 1,
				leadSuit: null,
				leaderPosition: winnerPos,
				isGhopte: false,
				cards: [],
				nextLeaderPosition: null,
				winnerPosition: null,
			},
			actions: nextActions,
		};
	}

	// Trick not complete: advance turn to other player
	const nextPos = ((playerPos + 1) % 2) as PlayerPosition;

	return {
		...state,
		hands: updatedHands,
		stacks2P: updatedStacks,
		play: {
			number: newPlayNumber,
			card: playedCardObj,
			playerPosition: nextPos,
			isGhopte: false,
			isTurup,
			makesTurup: false,
		},
		trick: {
			...currentTrickSnapshot,
			playNumber: currentTrickCards.length + 1,
		},
		actions: nextActions,
	};
}

// Event Emission

export function emitPlayCardEvents({
	prevState,
	state,
	nextState,
	action,
	emitter,
	winnerTeam = null,
}: {
	prevState?: GameState;
	state?: GameState;
	nextState: GameState;
	action: PlayCardAction;
	emitter: EventDispatcher;
	winnerTeam?: string | null;
}): void {
	const prev = prevState ?? state ?? nextState;
	emitter.emit("CardPlayed", {
		playerId: action.payload.playerId,
		card: action.payload.card,
	});

	if (prev.game.turup !== nextState.game.turup && nextState.game.turup) {
		if (!prev.game.turup) {
			emitter.emit("TurupCreated", {
				suit: nextState.game.turup,
			});
		} else {
			emitter.emit("TurupChanged", {
				oldSuit: prev.game.turup,
				newSuit: nextState.game.turup,
			});
		}
	}

	if (nextState.game.phase === GAME_PHASES.END) {
		emitter.emit("GameFinished", {
			winnerTeam,
			scores: nextState.scoring.scores,
		});
	} else {
		const currentPlayer = getCurrentTurnPlayer(nextState);
		if (currentPlayer) {
			emitter.emit("TurnStarted", {
				playerId: currentPlayer.id,
			});
		}
	}
}
