import { createDeck, shuffleDeck } from "../deck";
import { parseCard } from "../card";
import { DalMaraError } from "../errors";
import { ACTION_TYPES, ENGINE_ERROR_CODES, GAME_PHASES } from "../const";
import type { Action, GameState, PlayedCard, PlayerPosition, Trick } from "../../types/index";
import { dealFourPlayer, detectGhopte, getAnticlockwiseNextPosition, resolve4PTrickWinner } from "../rules/four-player";
import { createInitialScoreState, isGameFinished4P, updateScoreOnTrickWon } from "../scoring/scoring";

export function gameReducer4P(state: GameState, action: Action): GameState {
	const nextActions = [...state.actions, action];

	const dealer = state.players.find((p) => p.position === state.game.dealerPosition);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	switch (action.type) {
		case ACTION_TYPES.DEAL: {
			const { deck } = action.payload;
			if (state.game.phase !== GAME_PHASES.DEAL) return state;

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

				return {
					...state,
					game: {
						...state.game,
						phase: GAME_PHASES.GHOPTE,
					},
					hands,
					ghopteState,
					play: {
						number: 0,
						card: null,
						playerPosition: activeGhopte.declarerPosition,
						isGhopte: false,
						isTurup: false,
						makesTurup: false,
					},
					trick: {
						number: 1,
						playNumber: 1,
						leadSuit: activeGhopte.suit,
						leaderPosition: activeGhopte.declarerPosition,
						isGhopte: true,
						cards: [],
						nextLeaderPosition: null,
						winnerPosition: null,
					},
					actions: nextActions,
				};
			}

			// Normal 4P start (no Ghopte)
			const firstTurnPos = ((dealer.position + 1) % 4) as PlayerPosition;

			return {
				...state,
				game: {
					...state.game,
					phase: GAME_PHASES.PLAYING,
				},
				hands,
				play: {
					number: 0,
					card: null,
					playerPosition: firstTurnPos,
					isGhopte: false,
					isTurup: false,
					makesTurup: false,
				},
				trick: {
					number: 1,
					playNumber: 1,
					leadSuit: null,
					leaderPosition: firstTurnPos,
					isGhopte: false,
					cards: [],
					nextLeaderPosition: null,
					winnerPosition: null,
				},
				actions: nextActions,
			};
		}

		case ACTION_TYPES.PLAY_GHOPTE: {
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

			if (state.game.phase !== GAME_PHASES.GHOPTE || !state.ghopteState) return state;

			const currentGhopte = state.ghopteState.ghoptes[state.ghopteState.activeIndex];
			if (!currentGhopte) return state;

			const targetSuit = currentGhopte.suit;
			const isLead = state.trick.cards.length === 0;
			const currentTrickLeadSuit = isLead ? targetSuit : state.trick.leadSuit;

			const updatedTrickCards = [...state.trick.cards, playedCardItem];
			const isTrickComplete = updatedTrickCards.length === 4;
			const newPlayNumber = state.play.number + 1;

			const currentTrickSnapshot: Trick = {
				number: state.trick.number,
				playNumber: updatedTrickCards.length,
				leadSuit: currentTrickLeadSuit,
				leaderPosition: state.trick.leaderPosition,
				isGhopte: true,
				cards: updatedTrickCards,
				nextLeaderPosition: null,
				winnerPosition: null,
			};

			if (isTrickComplete) {
				const winnerId = resolve4PTrickWinner({
					trick: currentTrickSnapshot,
					currentTurup: null,
				});

				const winnerPlayer = state.players.find((p) => p.id === winnerId);
				if (!winnerPlayer) return state;
				const winnerPos = winnerPlayer.position;

				// Mark current Ghopte as resolved
				const updatedGhoptes = state.ghopteState.ghoptes.map((g, idx) =>
					idx === state.ghopteState?.activeIndex ? { ...g, resolved: true } : g,
				);

				const nextGhopteIndex = state.ghopteState.activeIndex + 1;
				const hasMoreGhoptes = nextGhopteIndex < updatedGhoptes.length;
				const nextLeader = hasMoreGhoptes ? (updatedGhoptes[nextGhopteIndex]?.declarerPosition ?? winnerPos) : winnerPos;

				const completedTrick: Trick = {
					...currentTrickSnapshot,
					playNumber: 4,
					winnerPosition: winnerPos,
					nextLeaderPosition: nextLeader,
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

				if (hasMoreGhoptes) {
					const nextGhopte = updatedGhoptes[nextGhopteIndex];
					if (!nextGhopte) return state;

					return {
						...state,
						hands: updatedHands,
						ghopteState: {
							ghoptes: updatedGhoptes,
							activeIndex: nextGhopteIndex,
						},
						play: {
							number: newPlayNumber,
							card: playedCardObj,
							playerPosition: nextGhopte.declarerPosition,
							isGhopte: true,
							isTurup: false,
							makesTurup: false,
						},
						scoring: {
							scores: updatedScores,
						},
						trick: {
							number: state.trick.number + 1,
							playNumber: 1,
							leadSuit: nextGhopte.suit,
							leaderPosition: nextGhopte.declarerPosition,
							isGhopte: true,
							cards: [],
							nextLeaderPosition: null,
							winnerPosition: null,
						},
						actions: nextActions,
					};
				} else {
					// All Ghoptes resolved! Transition to PLAYING phase.
					return {
						...state,
						game: {
							...state.game,
							phase: GAME_PHASES.PLAYING,
						},
						hands: updatedHands,
						ghopteState: null,
						play: {
							number: newPlayNumber,
							card: playedCardObj,
							playerPosition: winnerPos,
							isGhopte: true,
							isTurup: false,
							makesTurup: false,
						},
						scoring: {
							scores: updatedScores,
						},
						trick: {
							number: state.trick.number + 1,
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
			}

			// Ghopte trick in progress: advance turn to next player
			const nextPos = ((playerPos + 1) % 4) as PlayerPosition;

			return {
				...state,
				hands: updatedHands,
				play: {
					number: newPlayNumber,
					card: playedCardObj,
					playerPosition: nextPos,
					isGhopte: true,
					isTurup: false,
					makesTurup: false,
				},
				trick: {
					...currentTrickSnapshot,
					playNumber: updatedTrickCards.length + 1,
				},
				actions: nextActions,
			};
		}

		case ACTION_TYPES.PLAY_CARD: {
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

		default:
			return state;
	}
}
