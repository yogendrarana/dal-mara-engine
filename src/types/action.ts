import type { Card, Suit } from "./card";
import type { Seat } from "./player";
import type { ACTION_TYPES } from "../core/const";

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

// actions

export type DealFourPlayerAction = {
	type: typeof ACTION_TYPES.DEAL_FOUR_PLAYER;
	payload: {
		deck?: readonly Card[];
		seat: Seat;
	};
};

export type DealTwoPlayerHandsAction = {
	type: typeof ACTION_TYPES.DEAL_TWO_PLAYER_HANDS;
	payload: {
		deck?: readonly Card[];
		seat: Seat;
	};
};

export type DealTwoPlayerStacksAction = {
	type: typeof ACTION_TYPES.DEAL_TWO_PLAYER_STACKS;
	payload: {
		deck?: readonly Card[];
		seat: Seat;
	};
};

export type DeclareTurupAction = {
	type: typeof ACTION_TYPES.DECLARE_TURUP;
	payload: {
		seat: Seat;
		suit: Suit;
	};
};

export type PickupTurupCardAction = {
	type: typeof ACTION_TYPES.PICKUP_TURUP_CARD;
	payload: {
		seat: Seat;
		card: Card;
	};
};

export type PlayCardAction = {
	type: typeof ACTION_TYPES.PLAY_CARD;
	payload: {
		seat: Seat;
		card: Card;
	};
};

export type PlayGhopteAction = {
	type: typeof ACTION_TYPES.PLAY_GHOPTE;
	payload: {
		seat: Seat;
		card: Card;
	};
};

export type Action =
	| DealFourPlayerAction
	| DealTwoPlayerHandsAction
	| DealTwoPlayerStacksAction
	| DeclareTurupAction
	| PickupTurupCardAction
	| PlayCardAction
	| PlayGhopteAction;
