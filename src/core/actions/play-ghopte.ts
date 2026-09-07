import { parseCard } from "../card";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES, RANKS } from "../const";
import { resolve4PTrickWinner } from "../rules/four-player";
import { createInitialScoreState, updateScoreOnTrickWon } from "../scoring/scoring";
import { getCurrentTurnPlayer } from "../turn";
import type { EventDispatcher } from "../../events/dispatcher";
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

	const hand = state.hands[player.id] ?? [];
	const cardToPlay = hand.find((c) => c === card) ?? null;

	if (!cardToPlay) {
		return createValidationError(ENGINE_ERROR_CODES.CARD_NOT_OWNED, `Player does not own card ${card}`);
	}

	if (state.ghopteState) {
		const unresolvedGhoptes = [...state.ghopteState.ghoptes].filter((g) => !g.resolved).sort((a, b) => a.order - b.order);
		const activeGhopte = unresolvedGhoptes[0];

		if (!activeGhopte) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION, "Active ghopte is not found.");
		}

		const isPlayerGhopteDeclarer = activeGhopte.declarerPosition === playerPosition;

		if (isPlayerGhopteDeclarer) {
			const cardDetails = parseCard(cardToPlay);
			if (cardDetails.suit !== activeGhopte.suit || cardDetails.rank !== RANKS.TEN) {
				return createValidationError(
					ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION,
					"Declarer must play the declared Ghopte 10 card",
				);
			}
		}

		if (!isPlayerGhopteDeclarer) {
			// player cannot throw their own pending Ghopte 10 for another player's Ghopte
			const isPendingOwnGhopte = state.ghopteState.ghoptes.some(
				(g) => g.declarerPosition === playerPosition && !g.resolved && g.tenCard === cardToPlay,
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
	const nextActions = [...state.actions, action];
	const { playerPosition, card } = action.payload;

	const currentPlayer = state.players.find((p) => p.position === playerPosition);
	if (!currentPlayer) return state;
	const playerId = currentPlayer.id;
	const playerPos = currentPlayer.position;

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
		}

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

// Event Emission

export function emitPlayGhopteEvents({
	prevState,
	state,
	nextState,
	action,
	emitter,
}: {
	prevState?: GameState;
	state?: GameState;
	nextState: GameState;
	action: PlayGhopteAction;
	emitter: EventDispatcher;
}): void {
	const prev = prevState ?? state ?? nextState;
	const player = nextState.players.find((p) => p.position === action.payload.playerPosition);
	emitter.emit("CardPlayed", {
		playerId: player?.id,
		playerPosition: action.payload.playerPosition,
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
		// Game ended during ghopte (unlikely but handled)
		emitter.emit("GameFinished", {
			winnerTeam: null,
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
