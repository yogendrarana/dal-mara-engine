import type { Player, PlayerPosition } from "./player";
import type { Action } from "./action";
import type { Card, Suit } from "./card";

import type { GAME_MODES, GAME_PHASES } from "../core/const";

// types

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];
export type GamePhase = (typeof GAME_PHASES)[keyof typeof GAME_PHASES];

export interface PlayedCard {
	readonly card: Card;
	readonly playerId: string;
	readonly playOrder: number;
}

export interface Trick {
	readonly number: number;
	// 1-4 in a 4P trick, 1-2 in 2P mode
	readonly playNumber: number;
	readonly leadSuit: Suit | null;
	readonly leaderPosition: PlayerPosition;
	readonly isGhopte: boolean;
	readonly cards: readonly PlayedCard[];
	readonly nextLeaderPosition: PlayerPosition | null;
	readonly winnerPosition: PlayerPosition | null;
}

export interface GhopteInfo {
	readonly declarerPosition: PlayerPosition;
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

export interface ScoreState {
	readonly capturedTensCount: number;
	readonly capturedTricksCount: number;
	readonly capturedTricks: Trick[];
}

export interface GameState {
	readonly id: string;

	readonly game: {
		readonly mode: GameMode;
		readonly dealerPosition: PlayerPosition;
		readonly turup: Suit | null;
		readonly phase: GamePhase;
	};

	readonly players: readonly Player[];
	readonly hands: Record<string, readonly Card[]>;
	readonly stacks2P: Record<string, readonly PlayerStack2P[]>;

	readonly ghopteState: GhopteState | null;

	readonly play: {
		readonly number: number;
		readonly card: Card | null;
		readonly playerPosition: PlayerPosition | null;
		readonly isGhopte: boolean;
		readonly isTurup: boolean;
		readonly makesTurup: boolean;
	};

	readonly trick: Trick;

	readonly scoring: {
		readonly scores: Record<string, ScoreState>;
	};

	readonly actions: readonly Action[];
}
