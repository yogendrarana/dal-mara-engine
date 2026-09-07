import { createInitialScoreState, isGameFinished2P, updateScoreOnTrickWon } from "../scoring/scoring";

import { createDeck, shuffleDeck } from "../deck";
import { parseCard } from "../card";
import { ACTION_TYPES, ENGINE_ERROR_CODES, GAME_PHASES } from "../const";
import type { Action, Card, GameState, PlayedCard, PlayerPosition, Trick } from "../../types/index";
import { create2PStacks, dealTwoPlayer, resolve2PTrickWinner } from "../rules/two-player";
import { DalMaraError } from "../errors";

export function gameReducer2P(state: GameState, action: Action): GameState {
	const nextActions = [...state.actions, action];

	const dealer = state.players.find((p) => p.position === state.game.dealerPosition);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	const dealerPosition = dealer.position;

	switch (action.type) {
		case ACTION_TYPES.DEAL: {
			const { deck } = action.payload;

			if (state.game.phase !== GAME_PHASES.DEAL) return state;
			if (state.players.length !== 2) return state;

			const finalDeck = deck.length === 52 ? deck : shuffleDeck(createDeck());

			const { hands, remainingDeck } = dealTwoPlayer({
				deck: finalDeck,
				dealerPosition: dealer.position,
				players: state.players,
			});

			const stacks2P = create2PStacks({ remainingDeck, players: state.players, dealerPosition: dealer.position });
			const nonDealerPosition = ((dealer.position + 1) % 2) as PlayerPosition;

			return {
				...state,
				game: {
					...state.game,
					phase: GAME_PHASES.TURUP_DECLARATION,
				},
				hands,
				stacks2P,
				play: {
					number: 0,
					card: null,
					playerPosition: nonDealerPosition,
					isGhopte: false,
					isTurup: false,
					makesTurup: false,
				},
				trick: {
					number: 1,
					playNumber: 1,
					leadSuit: null,
					leaderPosition: nonDealerPosition,
					isGhopte: false,
					cards: [],
					nextLeaderPosition: null,
					winnerPosition: null,
				},
				actions: nextActions,
			};
		}

		case ACTION_TYPES.DECLARE_TURUP: {
			if (state.game.phase !== GAME_PHASES.TURUP_DECLARATION) return state;

			const turupSuit = action.payload.suit;
			const nonDealerPosition = ((dealerPosition + 1) % 2) as PlayerPosition;

			return {
				...state,
				game: {
					...state.game,
					phase: GAME_PHASES.PLAYING,
					turup: turupSuit,
				},
				play: {
					...state.play,
					playerPosition: nonDealerPosition,
				},
				trick: {
					number: 1,
					playNumber: 1,
					leadSuit: null,
					leaderPosition: nonDealerPosition,
					isGhopte: false,
					cards: [],
					nextLeaderPosition: null,
					winnerPosition: null,
				},
				actions: nextActions,
			};
		}

		case ACTION_TYPES.PICKUP_TURUP_CARD: {
			const { playerId, card } = action.payload;

			if (!state.game.turup) return state;

			const playerStacks = state.stacks2P[playerId];
			if (!playerStacks) return state;

			const targetStack = playerStacks.find((s) => s.faceUpCard === card && parseCard(s.faceUpCard).suit === state.game.turup);
			if (!targetStack) return state;

			const targetCard = targetStack.faceUpCard;
			if (!targetCard) return state;

			const currentHand = state.hands[playerId] ?? [];
			const newHand = [...currentHand, targetCard];

			const newHidden = [...targetStack.hiddenCards];
			const nextFaceUp = newHidden.pop() ?? null;

			const newPlayerStacks = [...playerStacks];
			const targetIndex = newPlayerStacks.findIndex((s) => s.position === targetStack.position);

			newPlayerStacks[targetIndex] = {
				...targetStack,
				hiddenCards: newHidden,
				faceUpCard: nextFaceUp,
			};

			return {
				...state,
				hands: {
					...state.hands,
					[playerId]: newHand,
				},
				stacks2P: {
					...state.stacks2P,
					[playerId]: newPlayerStacks,
				},
				actions: nextActions,
			};
		}

		case ACTION_TYPES.PLAY_CARD: {
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

		default:
			return state;
	}
}
