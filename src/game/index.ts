import { exportToDMN } from "../dmn/index";
import { EventDispatcher } from "../events/dispatcher";
import { getLegalMoves, type LegalPlayableCard } from "../legal-moves/index";
import {
	createInitialState,
	gameReducer4P,
	gameReducer2P,
} from "../reducers/index";
import { exportReplay, type ReplayData } from "../replay/index";
import { serializeState } from "../serializers/index";
import { validateAction } from "../validators/index";
import type {
	Action,
	GameEvent,
	GameEventType,
	GameMode,
	GameState,
	Player,
	ScoreState,
	Suit,
	Trick,
	ValidationResult,
} from "../types/index";
import { ACTION_TYPES, GAME_MODES, GAME_PHASES } from "../types/index";

export class Game {
	private _state: GameState;
	private eventDispatcher: EventDispatcher = new EventDispatcher();

	constructor(initialState?: GameState) {
		this._state =
			initialState ??
			createInitialState({
				id: "game-1",
				mode: GAME_MODES.FOUR_PLAYER,
				players: [
					{ id: "p1", name: "Player 1" },
					{ id: "p2", name: "Player 2" },
					{ id: "p3", name: "Player 3" },
					{ id: "p4", name: "Player 4" },
				],
			});
	}

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

	public get dealerIndex(): number {
		return this._state.dealerIndex;
	}

	public get currentPlayer(): Player | null {
		if (!this._state.currentTurnPlayerId) return null;

		return (
			this._state.players.find(
				(p) => p.id === this._state.currentTurnPlayerId,
			) ?? null
		);
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
		return this._state.phase === GAME_PHASES.GAME_FINISHED;
	}

	public get winnerId(): string | null {
		return this._state.winnerId;
	}

	public on(
		eventType: GameEventType,
		listener: (event: GameEvent) => void,
	): () => void {
		return this.eventDispatcher.on(eventType, listener);
	}

	public onAny(listener: (event: GameEvent) => void): () => void {
		return this.eventDispatcher.onAny(listener);
	}

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

	public dispatch(action: Action): ValidationResult {
		const validation = this.validate(action);

		if (!validation.success) {
			return validation;
		}

		const prevTurup = this._state.currentTurup;

		// Dispatch directly to isolated 4P or 2P reducer
		if (this._state.mode === GAME_MODES.FOUR_PLAYER) {
			this._state = gameReducer4P(this._state, action);
		} else {
			this._state = gameReducer2P(this._state, action);
		}

		// Emit event notifications to subscribers
		switch (action.type) {
			case ACTION_TYPES.CREATE_GAME:
				this.eventDispatcher.emit("GameCreated", {
					gameId: this._state.id,
					mode: this._state.mode,
				});
				break;

			case ACTION_TYPES.JOIN_PLAYER:
				this.eventDispatcher.emit("PlayerJoined", {
					playerId: action.payload.id,
					name: action.payload.name,
				});
				break;

			case ACTION_TYPES.START_GAME:
				this.eventDispatcher.emit("GameStarted", { gameId: this._state.id });
				this.eventDispatcher.emit("CardsDealt", { phase: this._state.phase });

				if (this._state.phase === GAME_PHASES.GHOPTE) {
					this.eventDispatcher.emit("GhopteStarted", {
						ghopteState: this._state.ghopteState,
					});
				} else if (
					this._state.phase === GAME_PHASES.PLAYING &&
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

			case ACTION_TYPES.SUBMIT_GHOPTE_CARD:
			case ACTION_TYPES.PLAY_CARD:
				this.eventDispatcher.emit("CardPlayed", {
					playerId: action.payload.playerId,
					cardId: action.payload.cardId,
				});

				if (
					prevTurup !== this._state.currentTurup &&
					this._state.currentTurup
				) {
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

				if (this._state.phase === GAME_PHASES.GAME_FINISHED) {
					this.eventDispatcher.emit("GameFinished", {
						winnerId: this._state.winnerId,
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

	public addPlayer(player: { id: string; name: string }): ValidationResult {
		return this.dispatch({
			type: ACTION_TYPES.JOIN_PLAYER,
			payload: player,
		});
	}

	public start(): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.START_GAME });
	}

	public declareTurup(payload: {
		playerId: string;
		suit: Suit;
	}): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.DECLARE_TURUP, payload });
	}

	public pickupTurupCard(payload: {
		playerId: string;
		stackIndex?: number;
		stackId?: string;
	}): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.PICKUP_TURUP_CARD, payload });
	}

	public submitGhopteCard(payload: {
		playerId: string;
		cardId: string;
	}): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.SUBMIT_GHOPTE_CARD, payload });
	}

	public playCard(payload: {
		playerId: string;
		cardId: string;
		fromStackIndex?: number;
		stackId?: string;
	}): ValidationResult {
		return this.dispatch({ type: ACTION_TYPES.PLAY_CARD, payload });
	}
}
