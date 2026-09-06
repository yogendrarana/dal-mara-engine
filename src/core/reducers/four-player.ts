import { createDeck, shuffleDeck } from "../deck";
import { parseCard } from "../card";
import { DalMaraError } from "../errors";
import { ACTION_TYPES, ENGINE_ERROR_CODES, GAME_PHASES } from "../const";
import type { Action, GameState, PlayedCard, Trick } from "../../types/index";
import { dealFourPlayer, detectGhopte, getAnticlockwiseNextPosition, resolve4PTrickWinner } from "../rules/four-player";
import { createInitialScoreState, evaluateGameWinner4P, isGameFinished4P, updateScoreOnTrickWon } from "../scoring/scoring";

export function gameReducer4P(state: GameState, action: Action): GameState {
	const nextActionHistory = [...state.actionHistory, action];

	const dealer = state.players.find((p) => p.id === state.dealerId);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	switch (action.type) {
		case ACTION_TYPES.DEAL: {
			const { deck } = action.payload;
			if (state.phase !== GAME_PHASES.DEAL) return state;

			const finalDeck = deck?.length === 52 ? deck : shuffleDeck(createDeck());

			const hands = dealFourPlayer({
				deck: finalDeck,
				dealerPosition: dealer.position,
				players: state.players,
			});

			const ghopteState = detectGhopte({
				hands,
				players: state.players,
				dealerPosition: dealer.position,
			});

			if (ghopteState && ghopteState.ghoptes.length > 0) {
				const activeGhopte = ghopteState.ghoptes[ghopteState.activeIndex];
				if (!activeGhopte) return state;

				const declarer = state.players.find((p) => p.id === activeGhopte.declarerId);
				if (!declarer) return state;

				return {
					...state,
					phase: GAME_PHASES.GHOPTE,
					hands,
					ghopteState,
					currentTurnPlayerId: declarer.id,
					actionHistory: nextActionHistory,
				};
			}

			// Normal 4P start (no Ghopte)
			const firstTurnPos = getAnticlockwiseNextPosition(dealer.position, 4);
			const firstPlayer = state.players.find((p) => p.position === firstTurnPos);
			if (!firstPlayer) return state;

			return {
				...state,
				phase: GAME_PHASES.PLAYING,
				hands,
				currentTurnPlayerId: firstPlayer.id,
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.PLAY_GHOPTE: {
			const { playerId, card } = action.payload;

			const hand = state.hands[playerId];
			if (!hand) return state;

			const playedCardObj = hand.find((c) => c === card);
			if (!playedCardObj) return state;

			const updatedHands = {
				...state.hands,
				[playerId]: hand.filter((c) => c !== card),
			};

			const playedCardItem: PlayedCard = {
				playerId,
				card: playedCardObj,
				playOrder: state.currentTrick.cards.length + 1,
			};

			if (state.phase !== GAME_PHASES.GHOPTE || !state.ghopteState) return state;

			const currentGhopte = state.ghopteState.ghoptes[state.ghopteState.activeIndex];
			if (!currentGhopte) return state;

			const targetSuit = currentGhopte.suit;
			const isLead = state.currentTrick.cards.length === 0;
			const currentTrickLeadSuit = isLead ? targetSuit : state.currentTrick.leadSuit;

			const updatedTrickCards = [...state.currentTrick.cards, playedCardItem];
			const isTrickComplete = updatedTrickCards.length === 4;

			const updatedCurrentTrick: Trick = {
				trickNumber: state.roundNumber,
				leadSuit: currentTrickLeadSuit,
				cards: updatedTrickCards,
				winnerId: null,
			};

			if (isTrickComplete) {
				const winnerId = resolve4PTrickWinner({
					trick: updatedCurrentTrick,
					currentTurup: null,
				});

				const winnerPlayer = state.players.find((p) => p.id === winnerId);
				if (!winnerPlayer) return state;

				const wonCards = updatedTrickCards.map((pc) => pc.card);
				const currentScore = state.scores[winnerId] ?? createInitialScoreState();
				const updatedScore = updateScoreOnTrickWon({
					currentScore,
					wonCards,
					trickNumber: state.roundNumber,
					wonByPlayerId: winnerId,
				});

				const completedTrick: Trick = {
					...updatedCurrentTrick,
					winnerId,
				};

				const updatedTrickHistory = [...state.trickHistory, completedTrick];

				// Mark current Ghopte as resolved
				const updatedGhoptes = state.ghopteState.ghoptes.map((g, idx) =>
					idx === state.ghopteState?.activeIndex ? { ...g, resolved: true } : g,
				);

				const nextGhopteIndex = state.ghopteState.activeIndex + 1;
				const hasMoreGhoptes = nextGhopteIndex < updatedGhoptes.length;

				if (hasMoreGhoptes) {
					const nextGhopte = updatedGhoptes[nextGhopteIndex];
					if (!nextGhopte) return state;
					const nextDeclarer = state.players.find((p) => p.id === nextGhopte.declarerId);
					if (!nextDeclarer) return state;

					return {
						...state,
						hands: updatedHands,
						ghopteState: {
							ghoptes: updatedGhoptes,
							activeIndex: nextGhopteIndex,
						},
						scores: {
							...state.scores,
							[winnerId]: updatedScore,
						},
						trickHistory: updatedTrickHistory,
						roundNumber: state.roundNumber + 1,
						currentTurnPlayerId: nextDeclarer.id,
						currentTrick: {
							trickNumber: state.roundNumber + 1,
							leadSuit: null,
							cards: [],
							winnerId: null,
						},
						actionHistory: nextActionHistory,
					};
				} else {
					// All Ghoptes resolved! Transition to PLAYING phase.
					return {
						...state,
						phase: GAME_PHASES.PLAYING,
						hands: updatedHands,
						ghopteState: null,
						scores: {
							...state.scores,
							[winnerId]: updatedScore,
						},
						trickHistory: updatedTrickHistory,
						roundNumber: state.roundNumber + 1,
						currentTurnPlayerId: winnerId,
						currentTrick: {
							trickNumber: state.roundNumber + 1,
							leadSuit: null,
							cards: [],
							winnerId: null,
						},
						actionHistory: nextActionHistory,
					};
				}
			}

			// Ghopte trick in progress: advance turn to next player
			const currentPlayer = state.players.find((p) => p.id === playerId);
			if (!currentPlayer) return state;
			const nextPos = getAnticlockwiseNextPosition(currentPlayer.position, 4);
			const nextPlayer = state.players.find((p) => p.position === nextPos);
			if (!nextPlayer) return state;

			return {
				...state,
				hands: updatedHands,
				currentTrick: updatedCurrentTrick,
				currentTurnPlayerId: nextPlayer.id,
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.PLAY_CARD: {
			const { playerId, card } = action.payload;

			const hand = state.hands[playerId];
			if (!hand) return state;

			const playedCardObj = hand.find((c) => c === card);
			if (!playedCardObj) return state;

			const updatedHands = {
				...state.hands,
				[playerId]: hand.filter((c) => c !== card),
			};

			const playedCardItem: PlayedCard = {
				playerId,
				card: playedCardObj,
				playOrder: state.currentTrick.cards.length + 1,
			};

			const cardSuit = parseCard(playedCardObj).suit;
			const isLead = state.currentTrick.cards.length === 0;
			const currentTrickLeadSuit = isLead ? cardSuit : state.currentTrick.leadSuit;

			let newTurup = state.currentTurup;

			// Turup Creation & Override Logic (within the same trick):
			const trickHasOffSuitCard = state.currentTrick.cards.some((pc) => parseCard(pc.card).suit !== state.currentTrick.leadSuit);
			const turupFromPastTrick = state.currentTurup !== null && !trickHasOffSuitCard;

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

			const updatedTrickCards = [...state.currentTrick.cards, playedCardItem];
			const isTrickComplete = updatedTrickCards.length === 4;

			const updatedCurrentTrick: Trick = {
				trickNumber: state.roundNumber,
				leadSuit: currentTrickLeadSuit,
				cards: updatedTrickCards,
				winnerId: null,
			};

			// if trick is completed
			if (isTrickComplete) {
				const winnerId = resolve4PTrickWinner({
					trick: updatedCurrentTrick,
					currentTurup: newTurup,
				});

				const winnerPlayer = state.players.find((p) => p.id === winnerId);
				if (!winnerPlayer) return state;

				const wonCards = updatedTrickCards.map((pc) => pc.card);
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

				const updatedTrickHistory = [...state.trickHistory, completedTrick];

				const finished = isGameFinished4P({
					totalTricksPlayed: updatedTrickHistory.length,
					hands: updatedHands,
				});

				if (finished) {
					const winnerEval = evaluateGameWinner4P({
						scores: updatedScores,
						players: state.players,
					});

					return {
						...state,
						phase: GAME_PHASES.END,
						hands: updatedHands,
						currentTurup: newTurup,
						currentTrick: {
							trickNumber: Math.min(updatedTrickHistory.length + 1, 13),
							leadSuit: null,
							cards: [],
							winnerId: null,
						},
						scores: updatedScores,
						trickHistory: updatedTrickHistory,
						roundNumber: Math.min(updatedTrickHistory.length + 1, 13),
						currentTurnPlayerId: null,
						winnerTeam: winnerEval.winnerTeam,
						actionHistory: nextActionHistory,
					};
				}

				return {
					...state,
					hands: updatedHands,
					currentTurup: newTurup,
					currentTrick: {
						trickNumber: Math.min(updatedTrickHistory.length + 1, 13),
						leadSuit: null,
						cards: [],
						winnerId: null,
					},
					scores: updatedScores,
					trickHistory: updatedTrickHistory,
					roundNumber: Math.min(updatedTrickHistory.length + 1, 13),
					currentTurnPlayerId: winnerId,
					actionHistory: nextActionHistory,
				};
			}

			// trick not complete: advance turn to next player
			const currentPlayer = state.players.find((p) => p.id === playerId);
			if (!currentPlayer) return state;

			const nextPos = getAnticlockwiseNextPosition(currentPlayer.position, 4);
			const nextPlayer = state.players.find((p) => p.position === nextPos);
			if (!nextPlayer) return state;

			return {
				...state,
				hands: updatedHands,
				currentTurup: newTurup,
				currentTrick: updatedCurrentTrick,
				currentTurnPlayerId: nextPlayer.id,
				actionHistory: nextActionHistory,
			};
		}

		default:
			return state;
	}
}
