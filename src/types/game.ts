import type { Player, PlayerPosition } from "./player";
import type { Action } from "./action";
import type { Card, PlayedCard, Suit } from "./card";

import type { GAME_MODES, GAME_PHASES } from "../core/const";

// types

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];
export type GamePhase = (typeof GAME_PHASES)[keyof typeof GAME_PHASES];

export interface Trick {
	readonly trickNumber: number;
	readonly leadSuit: Suit | null;
	readonly cards: readonly PlayedCard[];
	readonly winnerId: string | null;
}

export interface GhopteInfo {
	readonly declarerId: string;
	readonly suit: Suit;
	readonly tenCard: Card;
	readonly order: number;
	readonly resolved: boolean;
}

export interface GhopteState {
	readonly ghoptes: readonly GhopteInfo[];
	readonly activeIndex: number;
}

export interface PlayerStack2P {
	readonly position: number;
	readonly hiddenCards: readonly Card[];
	readonly faceUpCard: Card | null;
}

export interface CapturedTrickRecord {
	readonly trickNumber: number;
	readonly cards: readonly Card[];
}

export interface ScoreState {
	readonly capturedTens: number;
	readonly capturedTricks: number;
	readonly capturedTrickRecords: readonly CapturedTrickRecord[];
}

export interface GameState {
	readonly id: string;
	readonly mode: GameMode;
	readonly phase: GamePhase;

	readonly players: readonly Player[];

	readonly dealerPosition: PlayerPosition;

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

	// Winner team when game finished
	readonly winnerTeam: string | null;

	// Recorded action history for replay
	readonly actionHistory: readonly Action[];
}
