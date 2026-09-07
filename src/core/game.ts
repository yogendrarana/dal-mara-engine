import type {
	Action,
	Card,
	DealAction,
	DeclareTurupAction,
	GameEvent,
	GameEventType,
	GameMode,
	GamePhase,
	GameState,
	PickupTurupCardAction,
	PlayCardAction,
	Player,
	PlayerPosition,
	PlayGhopteAction,
	ScoreState,
	Suit,
	Trick,
	ValidationResult,
} from "../types/index";

import { exportToDMN, fromDMN } from "./dmn";
import { deserializeState, serializeState } from "./serializers";
import { EventDispatcher } from "../events/dispatcher";
import { exportReplay, playReplay, type ReplayData } from "./replay";
import { validateCreateGame } from "./validators";
import { ACTION_TYPES, GAME_MODES, GAME_PHASES } from "./const";
import { getLegalMoves, type LegalPlayableCard } from "./legal-moves";
import { createInitialState } from "./state";
import { dispatchAction, validateAction } from "./actions";

import { getCurrentTurnPlayer } from "./turn";
import { evaluateGameWinner4P, evaluateGameWinner2P } from "./scoring/scoring";

export interface CreateGameOptions {
	readonly id: string;
	readonly mode: GameMode;
	readonly players: readonly Player[];
	readonly dealerPosition: PlayerPosition;
}

export class Game {
	private _state: GameState;
	private eventDispatcher: EventDispatcher = new EventDispatcher();

	private constructor(initialState: GameState) {
		this._state = initialState;
	}

	public static create(options: CreateGameOptions | GameState): Game | ValidationResult {
		if ("game" in options && "trick" in options) {
			return new Game(options as GameState);
		}

		const validation = validateCreateGame(options as CreateGameOptions);
		if (!validation.success) {
			return validation;
		}

		const initialState = createInitialState({
			id: options.id,
			mode: options.mode,
			players: options.players,
			dealerPosition: options.dealerPosition,
		});

		return new Game(initialState);
	}

	public static fromDMN(dmnString: string): Game | ValidationResult {
		return fromDMN(dmnString);
	}

	public static deserialize(json: string): Game | ValidationResult {
		const state = deserializeState(json);
		return Game.create(state);
	}

	public static playReplay(replay: ReplayData): Game | ValidationResult {
		const state = playReplay(replay);
		return Game.create(state);
	}

	// game access

	public get state(): GameState {
		return this._state;
	}

	public get id(): string {
		return this._state.id;
	}

	public get mode(): GameMode {
		return this._state.game.mode;
	}

	public get phase(): GamePhase {
		return this._state.game.phase;
	}

	public get players(): readonly Player[] {
		return this._state.players;
	}

	public get dealerPosition(): PlayerPosition {
		return this._state.game.dealerPosition;
	}

	public get currentPlayer(): Player | null {
		return getCurrentTurnPlayer(this._state);
	}

	public get currentTrick(): Trick {
		return this._state.trick;
	}

	public get currentTurup(): Suit | null {
		return this._state.game.turup;
	}

	public get scores(): Record<string, ScoreState> {
		return this._state.scoring.scores;
	}

	public get isFinished(): boolean {
		return this._state.game.phase === GAME_PHASES.END;
	}

	public get winnerTeam(): string | null {
		if (this._state.game.phase !== GAME_PHASES.END) return null;
		if (this._state.game.mode === GAME_MODES.FOUR_PLAYER) {
			return evaluateGameWinner4P({
				scores: this._state.scoring.scores,
				players: this._state.players,
			}).winnerTeam;
		}
		return evaluateGameWinner2P({
			scores: this._state.scoring.scores,
			players: this._state.players,
		}).winnerTeam;
	}

	// event dispatchers

	public on(eventType: GameEventType, listener: (event: GameEvent) => void): () => void {
		return this.eventDispatcher.on(eventType, listener);
	}

	public onAny(listener: (event: GameEvent) => void): () => void {
		return this.eventDispatcher.onAny(listener);
	}

	// public functions

	public validate(action: Action): ValidationResult {
		return validateAction({ state: this._state, action });
	}

	public getLegalMoves(playerId: string): LegalPlayableCard[] {
		return getLegalMoves(this._state, playerId);
	}

	public toDMN(): string {
		return exportToDMN(this._state);
	}

	public serialize(): string {
		return serializeState(this._state);
	}

	public exportReplay(): ReplayData {
		return exportReplay(this._state);
	}

	// game actions

	public deal(payload: { deck: readonly Card[]; playerPosition?: PlayerPosition; playerId?: string }): ValidationResult {
		let playerPosition = payload.playerPosition;
		if (playerPosition === undefined && payload.playerId) {
			const player = this._state.players.find((p) => p.id === payload.playerId);
			playerPosition = player ? player.position : (999 as unknown as PlayerPosition);
		}
		if (playerPosition === undefined) {
			playerPosition = this._state.game.dealerPosition;
		}
		return this.dispatch({
			type: ACTION_TYPES.DEAL,
			payload: { deck: payload.deck, playerPosition },
		});
	}

	public declareTurup(payload: { playerPosition?: PlayerPosition; playerId?: string; suit: Suit }): ValidationResult {
		let playerPosition = payload.playerPosition;
		if (playerPosition === undefined && payload.playerId) {
			const player = this._state.players.find((p) => p.id === payload.playerId);
			playerPosition = player ? player.position : (999 as unknown as PlayerPosition);
		}
		if (playerPosition === undefined) {
			playerPosition = this.currentPlayer?.position ?? 0;
		}
		return this.dispatch({
			type: ACTION_TYPES.DECLARE_TURUP,
			payload: { playerPosition, suit: payload.suit },
		});
	}

	public pickupTurupCard(payload: { playerPosition?: PlayerPosition; playerId?: string; card: Card }): ValidationResult {
		let playerPosition = payload.playerPosition;
		if (playerPosition === undefined && payload.playerId) {
			const player = this._state.players.find((p) => p.id === payload.playerId);
			playerPosition = player ? player.position : (999 as unknown as PlayerPosition);
		}
		if (playerPosition === undefined) {
			playerPosition = this.currentPlayer?.position ?? 0;
		}
		return this.dispatch({
			type: ACTION_TYPES.PICKUP_TURUP_CARD,
			payload: { playerPosition, card: payload.card },
		});
	}

	public submitGhopteCard(payload: { playerPosition?: PlayerPosition; playerId?: string; card: Card }): ValidationResult {
		let playerPosition = payload.playerPosition;
		if (playerPosition === undefined && payload.playerId) {
			const player = this._state.players.find((p) => p.id === payload.playerId);
			playerPosition = player ? player.position : (999 as unknown as PlayerPosition);
		}
		if (playerPosition === undefined) {
			playerPosition = this.currentPlayer?.position ?? 0;
		}
		return this.dispatch({
			type: ACTION_TYPES.PLAY_GHOPTE,
			payload: { playerPosition, card: payload.card },
		});
	}

	public playCard(payload: { playerPosition?: PlayerPosition; playerId?: string; card: Card }): ValidationResult {
		let playerPosition = payload.playerPosition;
		if (playerPosition === undefined && payload.playerId) {
			const player = this._state.players.find((p) => p.id === payload.playerId);
			playerPosition = player ? player.position : (999 as unknown as PlayerPosition);
		}
		if (playerPosition === undefined) {
			playerPosition = this.currentPlayer?.position ?? 0;
		}
		const actionPayload: PlayCardAction["payload"] = { playerPosition, card: payload.card };
		if (this._state.game.phase === GAME_PHASES.GHOPTE) {
			return this.submitGhopteCard(actionPayload);
		}
		return this.dispatch({ type: ACTION_TYPES.PLAY_CARD, payload: actionPayload });
	}

	// dispatch

	public dispatch(action: Action): ValidationResult {
		const result = dispatchAction({ state: this._state, action, emitter: this.eventDispatcher });
		if (result.validation.success) {
			this._state = result.state;
		}
		return result.validation;
	}
}
