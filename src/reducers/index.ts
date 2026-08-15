import { createDeck } from "../cards/deck";
import { shuffleDeck } from "../cards/shuffle";
import {
	assignTeams,
	dealFourPlayer,
	detectGhopte,
	getAnticlockwiseNextPosition,
	getFirstPlayerIndex,
	resolve4PTrickWinner,
} from "../rules/four-player";

import {
	create2PStacks,
	dealTwoPlayerInitial,
	resolve2PTrickWinner,
} from "../rules/two-player";

import {
	createInitialScoreState,
	evaluateGameWinner,
	updateScoreOnTrickWon,
} from "../scoring/scoring";

import type {
	Action,
	Card,
	GameMode,
	GameState,
	GhopteResolutionOrder,
	PlayedCard,
	Player,
	ScoreState,
	Trick,
} from "../types/index";

import {
	ACTION_TYPES,
	DalMaraError,
	GAME_MODES,
	GAME_PHASES,
	TEAMS,
} from "../types/index";

export interface CreateInitialStateOptions {
	id: string;
	mode: GameMode;
	players: readonly { id: string; name: string }[];
	dealerId?: string;
	dealerIndex?: number;
	seed?: number;
	ghopteResolutionOrder?: GhopteResolutionOrder;
}

/**
 * Initial state creator using a single config object.
 */
export function createInitialState(
	options: CreateInitialStateOptions,
): GameState {
	const {
		id,
		mode,
		players: initialPlayers,
		dealerId: initialDealerId,
		dealerIndex: initialDealerIndex,
		seed = Date.now(),
		ghopteResolutionOrder = "dealer-last",
	} = options;

	const players: Player[] = initialPlayers.map((p, index) => {
		const position = index;
		let teamId = p.id;
		if (mode === GAME_MODES.FOUR_PLAYER) {
			teamId = position % 2 === 0 ? TEAMS.TEAM_1 : TEAMS.TEAM_2;
		}
		return {
			id: p.id,
			name: p.name,
			position,
			teamId,
		};
	});

	let dealerIndex = 0;
	let dealerId = players[0]?.id ?? "p1";

	if (initialDealerId) {
		const foundIdx = players.findIndex((p) => p.id === initialDealerId);
		if (foundIdx >= 0) {
			dealerIndex = foundIdx;
			dealerId = initialDealerId;
		}
	} else if (
		initialDealerIndex !== undefined &&
		initialDealerIndex >= 0 &&
		initialDealerIndex < players.length
	) {
		dealerIndex = initialDealerIndex;
		dealerId = players[dealerIndex]?.id ?? dealerId;
	}

	const scores: Record<string, ScoreState> = {};
	for (const p of players) {
		scores[p.id] = createInitialScoreState();
	}

	return {
		id,
		mode,
		phase: GAME_PHASES.LOBBY,
		settings: { mode, seed, ghopteResolutionOrder },
		players,
		dealerId,
		dealerIndex,
		currentTurnPlayerId: null,
		hands: {},
		stacks2P: {},
		currentTrick: {
			leadSuit: null,
			cards: [],
			winnerId: null,
		},
		currentTurup: null,
		ghopteState: null,
		scores,
		trickHistory: [],
		roundNumber: 1,
		winnerId: null,
		rngSeed: seed,
		rngState: seed,
		actionHistory: [],
	};
}

/**
 * 4-Player Game Reducer (Isolated 4P Logic)
 */
export function gameReducer4P(state: GameState, action: Action): GameState {
	const nextActionHistory = [...state.actionHistory, action];

	switch (action.type) {
		case ACTION_TYPES.JOIN_PLAYER: {
			if (state.phase !== GAME_PHASES.LOBBY) return state;
			if (state.players.length >= 4) return state;

			const position = state.players.length;
			const newPlayer: Player = {
				id: action.payload.id,
				name: action.payload.name,
				position,
				teamId: position % 2 === 0 ? TEAMS.TEAM_1 : TEAMS.TEAM_2,
			};

			const updatedPlayers = assignTeams([...state.players, newPlayer]);
			const updatedScores = {
				...state.scores,
				[newPlayer.id]: createInitialScoreState(),
			};

			return {
				...state,
				players: updatedPlayers,
				scores: updatedScores,
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.START_GAME: {
			if (state.players.length !== 4) return state;

			const initialDeck = createDeck();
			const { shuffled, nextRngState } = shuffleDeck(
				initialDeck,
				state.rngState,
			);

			const hands = dealFourPlayer({
				deck: shuffled,
				dealerIndex: state.dealerIndex,
				players: state.players,
			});

			const ghopteState = detectGhopte(
				hands,
				state.players,
				state.dealerIndex,
				state.settings.ghopteResolutionOrder ?? "dealer-last",
			);

			if (ghopteState && ghopteState.ghoptes.length > 0) {
				const activeGhopte = ghopteState.ghoptes[ghopteState.activeIndex];
				if (!activeGhopte) return state;

				const declarer = state.players.find(
					(p) => p.id === activeGhopte.declarerId,
				);
				if (!declarer) return state;

				const firstTurnPos = getAnticlockwiseNextPosition(declarer.position, 4);
				const firstTurnPlayer = state.players.find(
					(p) => p.position === firstTurnPos,
				);
				if (!firstTurnPlayer) return state;

				return {
					...state,
					phase: GAME_PHASES.GHOPTE,
					hands,
					ghopteState,
					currentTurnPlayerId: firstTurnPlayer.id,
					rngState: nextRngState,
					actionHistory: nextActionHistory,
				};
			}

			// Normal 4P start (no Ghopte)
			const firstTurnPos = getFirstPlayerIndex(state.dealerIndex, 4);
			const firstPlayer = state.players.find(
				(p) => p.position === firstTurnPos,
			);
			if (!firstPlayer) return state;

			return {
				...state,
				phase: GAME_PHASES.PLAYING,
				hands,
				currentTurnPlayerId: firstPlayer.id,
				rngState: nextRngState,
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.SUBMIT_GHOPTE_CARD:
		case ACTION_TYPES.PLAY_CARD: {
			const { playerId, cardId } = action.payload;

			const hand = state.hands[playerId];
			if (!hand) return state;

			const playedCardObj = hand.find((c) => c.id === cardId);
			if (!playedCardObj) return state;

			const updatedHands = {
				...state.hands,
				[playerId]: hand.filter((c) => c.id !== cardId),
			};

			const playedCardItem: PlayedCard = {
				playerId,
				card: playedCardObj,
			};

			// 1. GHOPTE Phase Play
			if (state.phase === GAME_PHASES.GHOPTE && state.ghopteState) {
				const currentGhopte =
					state.ghopteState.ghoptes[state.ghopteState.activeIndex];
				if (!currentGhopte) return state;

				const targetSuit = currentGhopte.suit;
				const isLead = state.currentTrick.cards.length === 0;
				const currentTrickLeadSuit = isLead
					? targetSuit
					: state.currentTrick.leadSuit;

				const updatedTrickCards = [...state.currentTrick.cards, playedCardItem];
				const isTrickComplete = updatedTrickCards.length === 4;

				const updatedCurrentTrick: Trick = {
					leadSuit: currentTrickLeadSuit,
					cards: updatedTrickCards,
					winnerId: null,
				};

				if (isTrickComplete) {
					const winnerId = resolve4PTrickWinner({
						trick: updatedCurrentTrick,
						currentTurup: null,
					});

					const wonCards = updatedTrickCards.map((pc) => pc.card);
					const currentScore =
						state.scores[winnerId] ?? createInitialScoreState();
					const updatedScore = updateScoreOnTrickWon({
						currentScore,
						wonCards,
						roundNumber: state.roundNumber,
						wonByPlayerId: winnerId,
					});

					const completedTrick: Trick = {
						...updatedCurrentTrick,
						winnerId,
					};

					const updatedTrickHistory = [...state.trickHistory, completedTrick];

					// Mark current Ghopte as resolved
					const updatedGhoptes = state.ghopteState.ghoptes.map((g, idx) =>
						idx === state.ghopteState?.activeIndex
							? { ...g, resolved: true }
							: g,
					);

					const nextGhopteIndex = state.ghopteState.activeIndex + 1;
					const hasMoreGhoptes = nextGhopteIndex < updatedGhoptes.length;

					if (hasMoreGhoptes) {
						const nextGhopte = updatedGhoptes[nextGhopteIndex];
						if (!nextGhopte) return state;
						const nextDeclarer = state.players.find(
							(p) => p.id === nextGhopte.declarerId,
						);
						if (!nextDeclarer) return state;

						const firstTurnPos = getAnticlockwiseNextPosition(
							nextDeclarer.position,
							4,
						);
						const firstTurnPlayer = state.players.find(
							(p) => p.position === firstTurnPos,
						);
						if (!firstTurnPlayer) return state;

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
							currentTurnPlayerId: firstTurnPlayer.id,
							currentTrick: {
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

			// 2. Standard PLAYING Phase Play (4P)
			const isLead = state.currentTrick.cards.length === 0;
			const currentTrickLeadSuit = isLead
				? playedCardObj.suit
				: state.currentTrick.leadSuit;

			let newTurup = state.currentTurup;

			// Permanent Turup Rule:
			// If Turup has NOT yet been permanently fixed (state.currentTurup is null) and card played voids lead suit:
			// First void suit play creates Turup. Subsequent void suit plays in that SAME TRICK can override Turup.
			// Once this trick completes, newTurup is permanently fixed for the rest of the game!
			if (!state.currentTurup && playedCardObj.suit !== currentTrickLeadSuit) {
				newTurup = playedCardObj.suit;
			}

			const updatedTrickCards = [...state.currentTrick.cards, playedCardItem];
			const isTrickComplete = updatedTrickCards.length === 4;

			const updatedCurrentTrick: Trick = {
				leadSuit: currentTrickLeadSuit,
				cards: updatedTrickCards,
				winnerId: null,
			};

			if (isTrickComplete) {
				const winnerId = resolve4PTrickWinner({
					trick: updatedCurrentTrick,
					currentTurup: newTurup,
				});

				const winnerPlayer = state.players.find((p) => p.id === winnerId);
				if (!winnerPlayer) return state;

				const wonCards = updatedTrickCards.map((pc) => pc.card);
				const currentScore =
					state.scores[winnerId] ?? createInitialScoreState();
				const updatedScore = updateScoreOnTrickWon({
					currentScore,
					wonCards,
					roundNumber: state.roundNumber,
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

				const winnerEval = evaluateGameWinner({
					mode: GAME_MODES.FOUR_PLAYER,
					scores: updatedScores,
					players: state.players,
					totalTricksPlayed: updatedTrickHistory.length,
					hands: updatedHands,
				});

				if (winnerEval.isFinished) {
					return {
						...state,
						phase: GAME_PHASES.GAME_FINISHED,
						hands: updatedHands,
						currentTurup: newTurup,
						currentTrick: {
							leadSuit: null,
							cards: [],
							winnerId: null,
						},
						scores: updatedScores,
						trickHistory: updatedTrickHistory,
						roundNumber: Math.min(updatedTrickHistory.length + 1, 13),
						currentTurnPlayerId: null,
						winnerId: winnerEval.winnerId,
						actionHistory: nextActionHistory,
					};
				}

				return {
					...state,
					hands: updatedHands,
					currentTurup: newTurup, // Permanently set for all future tricks
					currentTrick: {
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

			// Trick not complete: advance turn to next player
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

/**
 * 2-Player Game Reducer (Isolated 2P Logic)
 */
export function gameReducer2P(state: GameState, action: Action): GameState {
	const nextActionHistory = [...state.actionHistory, action];

	switch (action.type) {
		case ACTION_TYPES.JOIN_PLAYER: {
			if (state.phase !== GAME_PHASES.LOBBY) return state;
			if (state.players.length >= 2) return state;

			const position = state.players.length;
			const newPlayer: Player = {
				id: action.payload.id,
				name: action.payload.name,
				position,
				teamId: action.payload.id,
			};

			const updatedPlayers = [...state.players, newPlayer];
			const updatedScores = {
				...state.scores,
				[newPlayer.id]: createInitialScoreState(),
			};

			return {
				...state,
				players: updatedPlayers,
				scores: updatedScores,
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.START_GAME: {
			if (state.players.length !== 2) return state;

			const initialDeck = createDeck();
			const { shuffled, nextRngState } = shuffleDeck(
				initialDeck,
				state.rngState,
			);

			const { hands, remainingDeck } = dealTwoPlayerInitial(
				shuffled,
				state.dealerIndex,
				state.players,
			);

			const stacks2P = create2PStacks(
				remainingDeck,
				state.players,
				state.dealerIndex,
			);
			const nonDealerIndex = (state.dealerIndex + 1) % 2;
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
			const nonDealerIndex = (state.dealerIndex + 1) % 2;
			const nonDealer = state.players[nonDealerIndex];
			if (!nonDealer) return state;

			return {
				...state,
				phase: GAME_PHASES.PLAYING,
				currentTurup: turupSuit,
				currentTurnPlayerId: nonDealer.id,
				currentTrick: {
					leadSuit: null,
					cards: [],
					winnerId: null,
				},
				actionHistory: nextActionHistory,
			};
		}

		case ACTION_TYPES.PICKUP_TURUP_CARD: {
			if (!state.currentTurup) return state;

			const { playerId, stackIndex, stackId } = action.payload;
			const playerStacks = state.stacks2P[playerId];
			if (!playerStacks) return state;

			let targetIdx = -1;
			if (stackId) {
				targetIdx = playerStacks.findIndex((s) => s.id === stackId);
			} else if (
				stackIndex !== undefined &&
				stackIndex >= 0 &&
				stackIndex < playerStacks.length
			) {
				targetIdx = stackIndex;
			}

			if (targetIdx < 0) return state;

			const stack = playerStacks[targetIdx];
			if (
				!stack ||
				!stack.faceUpCard ||
				stack.faceUpCard.suit !== state.currentTurup
			) {
				return state;
			}

			const targetCard = stack.faceUpCard;
			const currentHand = state.hands[playerId] ?? [];
			const newHand = [...currentHand, targetCard];

			const newHidden = [...stack.hiddenCards];
			const nextFaceUp = newHidden.pop() ?? null;

			const newPlayerStacks = [...playerStacks];
			newPlayerStacks[targetIdx] = {
				...stack,
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
			const { playerId, cardId, fromStackIndex, stackId } = action.payload;

			let playedCardObj: Card | null = null;
			const updatedHands = { ...state.hands };
			const updatedStacks = { ...state.stacks2P };

			const playerStacks = [...(updatedStacks[playerId] ?? [])];

			// 1. Play from stack via stackId or fromStackIndex
			let targetStackIdx = -1;
			if (stackId) {
				targetStackIdx = playerStacks.findIndex((s) => s.id === stackId);
			} else if (fromStackIndex !== undefined) {
				targetStackIdx = fromStackIndex;
			}

			if (targetStackIdx >= 0 && targetStackIdx < playerStacks.length) {
				const stack = playerStacks[targetStackIdx];
				if (stack && stack.faceUpCard && stack.faceUpCard.id === cardId) {
					playedCardObj = stack.faceUpCard;
					const newHidden = [...stack.hiddenCards];
					const nextFaceUp = newHidden.pop() ?? null;
					playerStacks[targetStackIdx] = {
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
					// Search face-up stacks as fallback if stackId was omitted
					const sIdx = playerStacks.findIndex(
						(s) => s.faceUpCard?.id === cardId,
					);
					if (sIdx >= 0) {
						const stack = playerStacks[sIdx];
						if (stack && stack.faceUpCard) {
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
			};

			const isLead = state.currentTrick.cards.length === 0;
			const currentTrickLeadSuit = isLead
				? playedCardObj.suit
				: state.currentTrick.leadSuit;

			const updatedTrickCards = [...state.currentTrick.cards, playedCardItem];
			const isTrickComplete = updatedTrickCards.length === 2;

			const updatedCurrentTrick: Trick = {
				leadSuit: currentTrickLeadSuit,
				cards: updatedTrickCards,
				winnerId: null,
			};

			if (isTrickComplete) {
				const winnerId = resolve2PTrickWinner({
					trick: updatedCurrentTrick,
					currentTurup: state.currentTurup,
				});

				const winnerPlayer = state.players.find((p) => p.id === winnerId);
				if (!winnerPlayer) return state;

				const wonCards = updatedTrickCards.map((pc) => pc.card);
				const currentScore =
					state.scores[winnerId] ?? createInitialScoreState();
				const updatedScore = updateScoreOnTrickWon({
					currentScore,
					wonCards,
					roundNumber: state.roundNumber,
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

				const winnerEval = evaluateGameWinner({
					mode: GAME_MODES.TWO_PLAYER,
					scores: updatedScores,
					players: state.players,
					totalTricksPlayed: updatedTrickHistory.length,
					hands: updatedHands,
					stacks2P: updatedStacks,
				});

				if (winnerEval.isFinished) {
					return {
						...state,
						phase: GAME_PHASES.GAME_FINISHED,
						hands: updatedHands,
						stacks2P: updatedStacks,
						currentTrick: {
							leadSuit: null,
							cards: [],
							winnerId: null,
						},
						scores: updatedScores,
						trickHistory: updatedTrickHistory,
						roundNumber: Math.min(updatedTrickHistory.length + 1, 26),
						currentTurnPlayerId: null,
						winnerId: winnerEval.winnerId,
						actionHistory: nextActionHistory,
					};
				}

				return {
					...state,
					hands: updatedHands,
					stacks2P: updatedStacks,
					currentTrick: {
						leadSuit: null,
						cards: [],
						winnerId: null,
					},
					scores: updatedScores,
					trickHistory: updatedTrickHistory,
					roundNumber: Math.min(updatedTrickHistory.length + 1, 26),
					currentTurnPlayerId: winnerId,
					actionHistory: nextActionHistory,
				};
			}

			// Trick not complete: advance turn to other player
			const currentTurnIndex = state.players.findIndex(
				(p) => p.id === playerId,
			);
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

/**
 * Main Pure Game Reducer dispatcher.
 */
export function gameReducer(state: GameState, action: Action): GameState {
	if (state.mode === GAME_MODES.FOUR_PLAYER) {
		return gameReducer4P(state, action);
	}
	return gameReducer2P(state, action);
}
