import { createInitialScoreState, evaluateGameWinner2P, isGameFinished2P, updateScoreOnTrickWon } from "../scoring/scoring";

import { createDeck } from "../deck";
import { shuffleDeck } from "../shuffle";
import { ACTION_TYPES, ENGINE_ERROR_CODES, GAME_PHASES } from "../constants";
import type { Action, Card, GameState, PlayedCard, Trick } from "../../types/index";
import { create2PStacks, dealTwoPlayer, resolve2PTrickWinner } from "../rules/two-player";
import { DalMaraError } from "../errors";

export function gameReducer2P(state: GameState, action: Action): GameState {
	const nextActionHistory = [...state.actionHistory, action];

	const dealer = state.players.find((p) => p.id === state.dealerId);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	const dealerPosition = dealer.position;

	switch (action.type) {
		case ACTION_TYPES.SHUFFLE: {
			const { deck } = action.payload;
			if (state.phase !== GAME_PHASES.DEAL) return state;

			const initialDeck = deck ?? createDeck();
			const { nextRngState } = shuffleDeck({ deck: initialDeck, rngState: state.rngState });

			return {
				...state,
				rngState: nextRngState,
				actionHistory: nextActionHistory,
			};
		}

		// @TODO: for 2P, first 6 hand cards are dealt, game goes to tutrup declaratoin phase
		// Once turup is declared only then stack cards are dealt.
		// So we need to do this:
		// a) Convert current DEAL action to DEAL_4P or 4P_DEAL, then add new actions for 2P like 2P_DEAL_HAND and 2P_DEAL_STACK
		// So in 2p this is the order the game has to follow: deal hand cards -> declatre turup by non dealer -> deal stack cards, no skipping allowed
		case ACTION_TYPES.DEAL: {
			const { deck } = action.payload;

			if (state.phase !== GAME_PHASES.DEAL) return state;
			if (state.players.length !== 2) return state;

			const initialDeck = deck ?? createDeck();

			const { shuffled, nextRngState } = shuffleDeck({ deck: initialDeck, rngState: state.rngState });
			const { hands, remainingDeck } = dealTwoPlayer({
				deck: shuffled,
				dealerPosition: dealer.position,
				players: state.players,
			});

			const stacks2P = create2PStacks({ remainingDeck, players: state.players, dealerPosition: dealer.position });
			const nonDealerIndex = (dealer.position + 1) % 2;
			const nonDealer = state.players[nonDealerIndex];
			if (!nonDealer) return state;

			return {
				...state,
				phase: GAME_PHASES.TURUP_DECLARATION,
				hands,
				stacks2P,
				currentTurnPlayerId: nonDealer.id,
				rngState: nextRngState,
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.DECLARE_TURUP: {
			if (state.phase !== GAME_PHASES.TURUP_DECLARATION) return state;

			const turupSuit = action.payload.suit;

			const nonDealerPosition = (dealerPosition + 1) % 2;
			const nonDealer = state.players[nonDealerPosition];
			if (!nonDealer) return state;

			return {
				...state,
				phase: GAME_PHASES.PLAYING,
				currentTurup: turupSuit,
				currentTurnPlayerId: nonDealer.id,
				currentTrick: {
					trickNumber: 1,
					leadSuit: null,
					cards: [],
					winnerId: null,
				},
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.PICKUP_TURUP_CARD: {
			const { playerId, cardId } = action.payload;

			if (!state.currentTurup) return state;

			const playerStacks = state.stacks2P[playerId];
			if (!playerStacks) return state;

			const targetStack = playerStacks.find((s) => s.faceUpCard?.id === cardId && s.faceUpCard?.suit === state.currentTurup);
			if (!targetStack) return state;

			const targetCard = targetStack.faceUpCard;
			if (!targetCard) return state;

			const currentHand = state.hands[playerId] ?? [];
			const newHand = [...currentHand, targetCard];

			const newHidden = [...targetStack.hiddenCards];
			const nextFaceUp = newHidden.pop() ?? null;

			const newPlayerStacks = [...playerStacks];
			const targetIndex = newPlayerStacks.findIndex((s) => s.position === targetStack.position && s.id === targetStack.id);

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
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.PLAY_CARD: {
			const { playerId, cardId } = action.payload;

			let playedCardObj: Card | null = null;
			const updatedHands = { ...state.hands };
			const updatedStacks = { ...state.stacks2P };
			const playerStacks = [...(updatedStacks[playerId] ?? [])];

			// 1. Play from stack if card belongs to stack
			const targetStackIndex = playerStacks.findIndex((s) => s.faceUpCard?.id === cardId);
			if (targetStackIndex >= 0 && targetStackIndex < playerStacks.length) {
				const stack = playerStacks[targetStackIndex];
				if (stack?.faceUpCard && stack.faceUpCard.id === cardId) {
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
				playedCardObj = hand.find((c) => c.id === cardId) ?? null;

				if (playedCardObj) {
					updatedHands[playerId] = hand.filter((c) => c.id !== cardId);
				} else {
					// @TODO: Card is already checked in stacks if they are in stacks as face up cards.
					// So, this fallback looks to be redundant

					// Search face-up stacks as fallback if stackId was omitted
					const sIdx = playerStacks.findIndex((s) => s.faceUpCard?.id === cardId);
					if (sIdx >= 0) {
						const stack = playerStacks[sIdx];
						if (stack?.faceUpCard) {
							playedCardObj = stack.faceUpCard;
							const newHidden = [...stack.hiddenCards];
							const nextFaceUp = newHidden.pop() ?? null;
							playerStacks[sIdx] = {
								...stack,
								hiddenCards: newHidden,
								faceUpCard: nextFaceUp,
							};
							updatedStacks[playerId] = playerStacks;
						}
					}
				}
			}

			// If card to play is not owned or invalid, return state directly
			if (!playedCardObj) return state;

			const playedCardItem: PlayedCard = {
				playerId,
				card: playedCardObj,
				playOrder: state.currentTrick.cards.length + 1,
			};

			const isLead = state.currentTrick.cards.length === 0;
			const currentTrickLeadSuit = isLead ? playedCardObj.suit : state.currentTrick.leadSuit;

			const currentTrickCards = [...state.currentTrick.cards, playedCardItem];
			const isTrickComplete = currentTrickCards.length === 2;

			const updatedCurrentTrick: Trick = {
				trickNumber: state.roundNumber,
				leadSuit: currentTrickLeadSuit,
				cards: currentTrickCards,
				winnerId: null,
			};

			if (isTrickComplete) {
				const winnerId = resolve2PTrickWinner({
					trick: updatedCurrentTrick,
					currentTurup: state.currentTurup,
				});

				const winnerPlayer = state.players.find((p) => p.id === winnerId);
				if (!winnerPlayer) return state;

				const wonCards = currentTrickCards.map((pc) => pc.card);
				const currentScore = state.scores[winnerId] ?? createInitialScoreState();

				const updatedScore = updateScoreOnTrickWon({
					currentScore,
					wonCards,
					trickNumber: state.roundNumber,
					wonByPlayerId: winnerId,
				});

				const updatedScores = {
					...state.scores,
					[winnerId]: updatedScore,
				};

				const completedTrick: Trick = {
					...updatedCurrentTrick,
					winnerId,
				};

				const newTrickHistory = [...state.trickHistory, completedTrick];

				const finished = isGameFinished2P({
					totalTricksPlayed: newTrickHistory.length,
					hands: updatedHands,
					stacks2P: updatedStacks,
				});

				if (finished) {
					const winnerEval = evaluateGameWinner2P({
						scores: updatedScores,
						players: state.players,
					});

					return {
						...state,
						phase: GAME_PHASES.END,
						hands: updatedHands,
						stacks2P: updatedStacks,
						currentTrick: {
							trickNumber: Math.min(newTrickHistory.length + 1, 26),
							leadSuit: null,
							cards: [],
							winnerId: null,
						},
						scores: updatedScores,
						trickHistory: newTrickHistory,
						roundNumber: Math.min(newTrickHistory.length + 1, 26),
						currentTurnPlayerId: null,
						winnerTeam: winnerEval.winnerTeam,
						actionHistory: nextActionHistory,
					};
				}

				return {
					...state,
					hands: updatedHands,
					stacks2P: updatedStacks,
					currentTrick: {
						trickNumber: Math.min(newTrickHistory.length + 1, 26),
						leadSuit: null,
						cards: [],
						winnerId: null,
					},
					scores: updatedScores,
					trickHistory: newTrickHistory,
					roundNumber: Math.min(newTrickHistory.length + 1, 26),
					currentTurnPlayerId: winnerId,
					actionHistory: nextActionHistory,
				};
			}

			// Trick not complete: advance turn to other player
			const currentTurnIndex = state.players.findIndex((p) => p.id === playerId);
			const nextTurnIndex = (currentTurnIndex + 1) % 2;
			const nextPlayer = state.players[nextTurnIndex];
			if (!nextPlayer) return state;

			return {
				...state,
				hands: updatedHands,
				stacks2P: updatedStacks,
				currentTrick: updatedCurrentTrick,
				currentTurnPlayerId: nextPlayer.id,
				actionHistory: nextActionHistory,
			};
		}

		default:
			return state;
	}
}
