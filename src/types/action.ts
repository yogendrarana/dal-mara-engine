import type { Card, CardId, Suit } from "./card";
import type { ACTION_TYPES } from "../core/constants";

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

// actions
export type Action =
	| {
			type: typeof ACTION_TYPES.SHUFFLE;
			payload: { deck: Card[]; playerId?: string };
	  }
	| {
			type: typeof ACTION_TYPES.DEAL;
			payload: { playerId: string; deck: readonly Card[] };
	  }
	| {
			type: typeof ACTION_TYPES.DECLARE_TURUP;
			payload: { playerId: string; suit: Suit };
	  }
	| {
			type: typeof ACTION_TYPES.PICKUP_TURUP_CARD;
			payload: { playerId: string; cardId: CardId };
	  }
	| {
			type: typeof ACTION_TYPES.PLAY_CARD;
			payload: {
				playerId: string;
				cardId: CardId;
			};
	  }
	| {
			type: typeof ACTION_TYPES.PLAY_GHOPTE;
			payload: { playerId: string; cardId: CardId };
	  };
