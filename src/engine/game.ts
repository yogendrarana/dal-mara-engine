import type {
	Action,
	Card,
	CardId,
	GameEvent,
	GameEventType,
	GameMode,
	GameState,
	GhopteResolutionOrder,
	Player,
	ScoreState,
	Suit,
	Trick,
	ValidationResult,
} from "../types/index";

import { exportToDMN } from "./dmn";
import { serializeState } from "./serializers";
import { EventDispatcher } from "../events/dispatcher";
import { exportReplay, type ReplayData } from "./replay";
import { validateAction, validateCreateGame } from "../core/validators";
import { ACTION_TYPES, GAME_MODES, GAME_PHASES, GHOPTE_RESOLUTION_ORDER } from "../core/const";
import { getLegalMoves, type LegalPlayableCard } from "../core/legal-moves";
import { createInitialState } from "../core/state";
import { gameReducer4P } from "../core/reducers/four-player";
import { gameReducer2P } from "../core/reducers/two-player";

export interface CreateGameOptions {
	readonly id: string;
	readonly mode: GameMode;
	readonly players: readonly Player[];
	readonly dealerId: string;
	readonly seed?: number;
	readonly ghopteResolutionOrder?: GhopteResolutionOrder;
}

export class Game {
	private _state: GameState;
	private eventDispatcher: EventDispatcher = new EventDispatcher();

	private constructor(initialState: GameState) {
		this._state = initialState;
	}

	public static create(options: CreateGameOptions | GameState): Game | ValidationResult {
		if ("phase" in options && "hands" in options) {
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
			dealerId: options.dealerId,
			seed: options.seed,
			ghopteResolutionOrder: options.ghopteResolutionOrder ?? GHOPTE_RESOLUTION_ORDER.DEALER_LAST,
		});

		return new Game(initialState);
	}

	// game access

	public get state(): GameState {
		return this._state;
	}

	public get id(): string {
		return this._state.id;
	}

	public get mode(): GameMode {
		return this._state.mode;
	}

	public get phase(): GameState["phase"] {
		return this._state.phase;
	}

	public get players(): readonly Player[] {
		return this._state.players;
	}

	public get dealerId(): string {
		return this._state.dealerId;
	}

	public get currentPlayer(): Player | null {
		if (!this._state.currentTurnPlayerId) return null;

		return this._state.players.find((p) => p.id === this._state.currentTurnPlayerId) ?? null;
	}

	public get currentTrick(): Trick {
		return this._state.currentTrick;
	}

	public get currentTurup(): Suit | null {
		return this._state.currentTurup;
	}

	public get scores(): Record<string, ScoreState> {
		return this._state.scores;
	}

	public get isFinished(): boolean {
		return this._state.phase === GAME_PHASES.END;
	}

	public get winnerTeam(): string | null {
		return this._state.winnerTeam;
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
		return validateAction(this._state, action);
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

	public start(deckOrPlayerId?: Card[] | string): ValidationResult {
		if (typeof deckOrPlayerId === "string") {
			return this.deal(undefined, deckOrPlayerId);
		}
		return this.deal(deckOrPlayerId, this.dealerId);
	}

	public shuffle(deckOrPlayerId?: Card[] | string, playerId?: string): ValidationResult {
		let deck: Card[] | undefined;
		let pId: string | undefined;

		if (Array.isArray(deckOrPlayerId)) {
			deck = deckOrPlayerId;
			pId = playerId;
		} else if (typeof deckOrPlayerId === "string") {
			pId = deckOrPlayerId;
		}

		return this.dispatch({
			type: ACTION_TYPES.SHUFFLE,
			payload: { deck, playerId: pId },
		} as any);
	}

	public deal(deckOrPlayerId?: Card[] | string, playerId?: string): ValidationResult {
		let deck: Card[] | undefined;
		let pId: string | undefined;

		if (Array.isArray(deckOrPlayerId)) {
			deck = deckOrPlayerId;
			pId = playerId ?? this.dealerId;
		} else if (typeof deckOrPlayerId === "string") {
			pId = deckOrPlayerId;
		} else {
			pId = this.dealerId;
		}

		return this.dispatch({
			type: ACTION_TYPES.DEAL,
			payload: { deck, playerId: pId },
		} as any);
	}

	public declareTurup(payload: { playerId: string; suit: Suit }): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.DECLARE_TURUP, payload });
	}

	public pickupTurupCard(payload: { playerId: string; cardId: CardId }): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.PICKUP_TURUP_CARD, payload });
	}

	public submitGhopteCard(payload: { playerId: string; cardId: CardId }): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.PLAY_GHOPTE, payload });
	}

	public playCard(payload: { playerId: string; cardId: CardId; stackPosition?: number; stackId?: string }): ValidationResult {
		if (this._state.phase === GAME_PHASES.GHOPTE) {
			return this.submitGhopteCard(payload);
		}
		return this.dispatch({ type: ACTION_TYPES.PLAY_CARD, payload });
	}

	// dispatch

	public dispatch(action: Action): ValidationResult {
		const validation = validateAction(this._state, action);

		if (!validation.success) {
			return validation;
		}

		this._state =
			this._state.mode === GAME_MODES.FOUR_PLAYER ? gameReducer4P(this._state, action) : gameReducer2P(this._state, action);

		const prevTurup = this._state.currentTurup;

		// emit event notifications to subscribers
		switch (action.type) {
			case ACTION_TYPES.DEAL:
				this.eventDispatcher.emit("CardsDealt", { phase: this._state.phase });

				if (this._state.phase === GAME_PHASES.GHOPTE) {
					this.eventDispatcher.emit("GhopteStarted", {
						ghopteState: this._state.ghopteState,
					});
				} else if (
					(this._state.phase === GAME_PHASES.PLAYING || this._state.phase === GAME_PHASES.TURUP_DECLARATION) &&
					this.currentPlayer
				) {
					this.eventDispatcher.emit("TurnStarted", {
						playerId: this.currentPlayer.id,
					});
				}
				break;

			case ACTION_TYPES.DECLARE_TURUP:
				this.eventDispatcher.emit("TurupDeclared", {
					playerId: action.payload.playerId,
					suit: action.payload.suit,
				});

				if (this.currentPlayer) {
					this.eventDispatcher.emit("TurnStarted", {
						playerId: this.currentPlayer.id,
					});
				}
				break;

			case ACTION_TYPES.PLAY_GHOPTE:
			case ACTION_TYPES.PLAY_CARD:
				this.eventDispatcher.emit("CardPlayed", {
					playerId: action.payload.playerId,
					cardId: action.payload.cardId,
				});

				if (prevTurup !== this._state.currentTurup && this._state.currentTurup) {
					if (!prevTurup) {
						this.eventDispatcher.emit("TurupCreated", {
							suit: this._state.currentTurup,
						});
					} else {
						this.eventDispatcher.emit("TurupChanged", {
							oldSuit: prevTurup,
							newSuit: this._state.currentTurup,
						});
					}
				}

				if (this._state.phase === GAME_PHASES.END) {
					this.eventDispatcher.emit("GameFinished", {
						winnerTeam: this._state.winnerTeam,
						scores: this._state.scores,
					});
				} else if (this.currentPlayer) {
					this.eventDispatcher.emit("TurnStarted", {
						playerId: this.currentPlayer.id,
					});
				}
				break;

			default:
				break;
		}

		return { success: true };
	}
}
