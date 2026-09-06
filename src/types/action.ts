import type { Card, Suit } from "./card";
import type { ACTION_TYPES } from "../core/const";

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

// actions

export type DealAction = {
	type: typeof ACTION_TYPES.DEAL;
	payload: {
		deck: readonly Card[];
		playerId: string;
	};
};

export type DeclareTurupAction = {
	type: typeof ACTION_TYPES.DECLARE_TURUP;
	payload: {
		playerId: string;
		suit: Suit;
	};
};

export type PickupTurupCardAction = {
	type: typeof ACTION_TYPES.PICKUP_TURUP_CARD;
	payload: {
		playerId: string;
		card: Card;
	};
};

export type PlayCardAction = {
	type: typeof ACTION_TYPES.PLAY_CARD;
	payload: {
		playerId: string;
		card: Card;
	};
};

export type PlayGhopteAction = {
	type: typeof ACTION_TYPES.PLAY_GHOPTE;
	payload: {
		playerId: string;
		card: Card;
	};
};

export type Action = DealAction | DeclareTurupAction | PickupTurupCardAction | PlayCardAction | PlayGhopteAction;
