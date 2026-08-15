import type { SuitAbbreviation } from "../cards/deck";

export const SUITS = {
	SPADES: "spades",
	HEARTS: "hearts",
	DIAMONDS: "diamonds",
	CLUBS: "clubs",
} as const;

export type Suit = (typeof SUITS)[keyof typeof SUITS];

export const RANKS = {
	TWO: "2",
	THREE: "3",
	FOUR: "4",
	FIVE: "5",
	SIX: "6",
	SEVEN: "7",
	EIGHT: "8",
	NINE: "9",
	TEN: "10",
	JACK: "J",
	QUEEN: "Q",
	KING: "K",
	ACE: "A",
} as const;

export type Rank = (typeof RANKS)[keyof typeof RANKS];

export type CardId = `${Rank}${SuitAbbreviation}`;

export interface Card {
	readonly id: CardId;
	readonly suit: Suit;
	readonly rank: Rank;
}

export const GAME_MODES = {
	FOUR_PLAYER: "4P",
	TWO_PLAYER: "2P",
} as const;

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];

export const GAME_PHASES = {
	LOBBY: "LOBBY",
	DEALING: "DEALING",
	TURUP_DECLARATION: "TURUP_DECLARATION", // 2P mode only
	GHOPTE: "GHOPTE", // 4P mode only
	PLAYING: "PLAYING",
	ROUND_FINISHED: "ROUND_FINISHED",
	GAME_FINISHED: "GAME_FINISHED",
} as const;

export type GamePhase = (typeof GAME_PHASES)[keyof typeof GAME_PHASES];

export const GHOPTE_RESOLUTION_ORDER = {
	DEALER_FIRST: "dealer-first",
	DEALER_LAST: "dealer-last",
} as const;

export type GhopteResolutionOrder =
	(typeof GHOPTE_RESOLUTION_ORDER)[keyof typeof GHOPTE_RESOLUTION_ORDER];

export const TEAMS = {
	TEAM_1: "team1",
	TEAM_2: "team2",
} as const;

export interface Player {
	readonly id: string;
	readonly name: string;
	readonly position: number; // 0 to 3 for 4P, 0 to 1 for 2P
	readonly teamId: string; // "team1" (pos 0 & 2) or "team2" (pos 1 & 3) in 4P; player ID in 2P
}

export interface PlayedCard {
	readonly playerId: string;
	readonly card: Card;
}

export interface Trick {
	readonly leadSuit: Suit | null;
	readonly cards: readonly PlayedCard[];
	readonly winnerId: string | null;
}

export interface PlayerStack2P {
	readonly id: string;
	readonly position: number;
	readonly hiddenCards: readonly Card[];
	readonly faceUpCard: Card | null;
}

export interface GhopteInfo {
	readonly order: number;
	readonly declarerId: string;
	readonly suit: Suit;
	readonly tenCard: Card;
	readonly resolved: boolean;
}

export interface GhopteState {
	readonly ghoptes: readonly GhopteInfo[];
	readonly activeIndex: number;
}

export interface CapturedTrickRecord {
	readonly roundNumber: number;
	readonly cards: readonly Card[];
	readonly wonByPlayerId: string;
}

export interface ScoreState {
	readonly capturedTens: number;
	readonly capturedTricks: number;
	readonly capturedCards: readonly Card[];
	readonly capturedTrickRecords: readonly CapturedTrickRecord[];
}

export interface GameSettings {
	readonly mode: GameMode;
	readonly seed?: number;
	readonly dealerRotation?: "anticlockwise" | "losing-team";
	readonly ghopteResolutionOrder?: GhopteResolutionOrder;
}

export interface GameState {
	readonly id: string;
	readonly mode: GameMode;
	readonly phase: GamePhase;
	readonly settings: GameSettings;
	readonly players: readonly Player[];
	readonly dealerId: string;
	readonly dealerIndex: number;
	readonly currentTurnPlayerId: string | null;
	// 13 card hand (4P) and 6 card hand (2P)
	readonly hands: Record<string, readonly Card[]>;
	// 2-Player specific stacks (4 stacks per player)
	readonly stacks2P: Record<string, readonly PlayerStack2P[]>;
	// Current trick in progress
	readonly currentTrick: Trick;
	// Current fixed (2P) or active (4P) Turup
	readonly currentTurup: Suit | null;
	// Active Ghopte state if in GHOPTE phase
	readonly ghopteState: GhopteState | null;
	// Scores by player ID (derived team scores for 4P)
	readonly scores: Record<string, ScoreState>;
	// Trick history for current round
	readonly trickHistory: readonly Trick[];
	// Current round number (1 to 13 total rounds)
	readonly roundNumber: number;
	// Winner team/player ID when game finished
	readonly winnerId: string | null;
	// Random Number Generator (RNG) seed & counter state for determinism
	readonly rngSeed: number;
	readonly rngState: number;
	// Recorded action history for replay
	readonly actionHistory: readonly Action[];
}

export const ACTION_TYPES = {
	CREATE_GAME: "CREATE_GAME",
	JOIN_PLAYER: "JOIN_PLAYER",
	START_GAME: "START_GAME",
	DECLARE_TURUP: "DECLARE_TURUP",
	PICKUP_TURUP_CARD: "PICKUP_TURUP_CARD",
	PLAY_CARD: "PLAY_CARD",
	SUBMIT_GHOPTE_CARD: "SUBMIT_GHOPTE_CARD",
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

// Actions
export type Action =
	| {
			type: typeof ACTION_TYPES.CREATE_GAME;
			payload: {
				id: string;
				mode: GameMode;
				players: readonly { id: string; name: string }[];
				dealerId?: string;
				dealerIndex?: number;
				seed?: number;
				ghopteResolutionOrder?: GhopteResolutionOrder;
			};
	  }
	| {
			type: typeof ACTION_TYPES.JOIN_PLAYER;
			payload: { id: string; name: string };
	  }
	| { type: typeof ACTION_TYPES.START_GAME }
	| {
			type: typeof ACTION_TYPES.DECLARE_TURUP;
			payload: { playerId: string; suit: Suit };
	  }
	| {
			type: typeof ACTION_TYPES.PICKUP_TURUP_CARD;
			payload: { playerId: string; stackIndex?: number; stackId?: string };
	  }
	| {
			type: typeof ACTION_TYPES.PLAY_CARD;
			payload: {
				playerId: string;
				cardId: string;
				fromStackIndex?: number;
				stackId?: string;
			};
	  }
	| {
			type: typeof ACTION_TYPES.SUBMIT_GHOPTE_CARD;
			payload: { playerId: string; cardId: string };
	  };

// Events
export type GameEventType =
	| "GameCreated"
	| "PlayerJoined"
	| "GameStarted"
	| "CardsDealt"
	| "TurupDeclared"
	| "TurupCreated"
	| "TurupChanged"
	| "TurnStarted"
	| "CardPlayed"
	| "GhopteStarted"
	| "GhopteCardSubmitted"
	| "GhopteResolved"
	| "TrickWon"
	| "TenCaptured"
	| "RoundFinished"
	| "GameFinished";

export interface GameEvent {
	readonly type: GameEventType;
	readonly payload: Record<string, unknown>;
	readonly timestamp: number;
}

// Engine validation result
export type ValidationResult =
	| { readonly success: true }
	| { readonly success: false; readonly error: EngineError };

export const ENGINE_ERROR_CODES = {
	INVALID_PHASE: "INVALID_PHASE",
	PLAYER_NOT_FOUND: "PLAYER_NOT_FOUND",
	GAME_FULL: "GAME_FULL",
	GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
	NOT_PLAYER_TURN: "NOT_PLAYER_TURN",
	CARD_NOT_OWNED: "CARD_NOT_OWNED",
	MUST_FOLLOW_SUIT: "MUST_FOLLOW_SUIT",
	INVALID_TURUP_DECLARATION: "INVALID_TURUP_DECLARATION",
	INVALID_GHOPTE_SUBMISSION: "INVALID_GHOPTE_SUBMISSION",
	INVALID_ACTION: "INVALID_ACTION",
	INVALID_PLAYER_COUNT: "INVALID_PLAYER_COUNT",
} as const;

export type EngineErrorCode =
	(typeof ENGINE_ERROR_CODES)[keyof typeof ENGINE_ERROR_CODES];

export interface EngineError {
	readonly code: EngineErrorCode;
	readonly message: string;
	readonly details?: Record<string, unknown>;
}

/**
 * Custom Error class for Dal Mara engine runtime and deserialization errors.
 */
export class DalMaraError extends Error {
	public readonly code?: string;
	public readonly details?: Record<string, unknown>;

	constructor(
		message: string,
		code?: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "DalMaraError";
		this.code = code;
		this.details = details;
		Object.setPrototypeOf(this, DalMaraError.prototype);
	}
}
