import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES } from "../const";
import { getCurrentTurnPlayer } from "../turn";
import type { EventDispatcher } from "../../events/dispatcher";
import type { DeclareTurupAction, GameState, PlayerPosition, ValidationResult } from "../../types/index";

// Validation

export function validateDeclareTurup({ state, action }: { state: GameState; action: DeclareTurupAction }): ValidationResult {
	const currentTurnPlayer = getCurrentTurnPlayer(state);

	if (state.game.mode !== GAME_MODES.TWO_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Turup declaration action is only valid in 2-Player mode");
	}

	if (state.game.phase !== GAME_PHASES.TURUP_DECLARATION) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot declare Turup outside TURUP_DECLARATION phase");
	}

	if (currentTurnPlayer?.position !== action.payload.playerPosition) {
		return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, "It is not your turn to declare Turup");
	}

	return { success: true };
}

// Reducer (2-Player only)

export function reduceDeclareTurup2P(state: GameState, action: DeclareTurupAction): GameState {
	const nextActions = [...state.actions, action];

	if (state.game.phase !== GAME_PHASES.TURUP_DECLARATION) return state;

	const turupSuit = action.payload.suit;
	const dealerPosition = state.game.dealerPosition;
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

// Event Emission

export function emitDeclareTurupEvents({
	nextState,
	action,
	emitter,
}: {
	prevState?: GameState;
	state?: GameState;
	nextState: GameState;
	action: DeclareTurupAction;
	emitter: EventDispatcher;
}): void {
	const player = nextState.players.find((p) => p.position === action.payload.playerPosition);
	emitter.emit("TurupDeclared", {
		playerId: player?.id,
		playerPosition: action.payload.playerPosition,
		suit: action.payload.suit,
	});

	const currentPlayer = getCurrentTurnPlayer(nextState);
	if (currentPlayer) {
		emitter.emit("TurnStarted", {
			playerId: currentPlayer.id,
		});
	}
}
