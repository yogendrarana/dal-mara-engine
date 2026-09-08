import type { Player, PlayerPosition } from "./player";
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
	readonly isGhopte: boolean;
	readonly cards: readonly PlayedCard[];
}

export interface Ghopte {
	readonly playerPosition: PlayerPosition;
	readonly card: Card;
	readonly order: number;
	readonly resolved: boolean;
}

export interface PlayerStack {
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
	// DMN Section 1: Game
	readonly game: {
		readonly mode: GameMode;
		readonly dealerPosition: PlayerPosition;
		readonly turup: Suit | null;
		readonly phase: GamePhase; // internal, not in DMN
	};

	// Player roster (derived from mode, not in DMN)
	readonly players: readonly Player[];

	// DMN Section 3: Hands (keyed by player id)
	readonly hands: Record<string, readonly Card[]>;

	// DMN Section 2: Ghoptes
	readonly ghoptes: readonly Ghopte[];

	// DMN Section 4: Stacks (2p only, keyed by player id)
	readonly stacks: Record<string, readonly PlayerStack[]>;

	// DMN Section 5: Move Number
	readonly moveNumber: number;

	// DMN Section 6: Trick
	readonly trick: Trick;

	// DMN Section 7: Move Detail
	readonly moveDetail: {
		readonly playerPosition: PlayerPosition | null;
		readonly card: Card | null;
		readonly makesTurup: boolean;
	};

	// DMN Section 8: Next Move Player Position
	readonly nextMovePlayerPosition: PlayerPosition;
}
