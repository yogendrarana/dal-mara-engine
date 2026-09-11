import { parseCard } from "../card";
import { DalMaraError } from "../errors";
import { createDeck, shuffleDeck } from "../deck";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_MODES } from "../const";
import { dealFourPlayer, detectGhopte } from "../rules/four-player";
import { dealTwoPlayer, create2PStacks, getRemainingCards2P } from "../rules/two-player";
import type {
	Card,
	DealFourPlayerAction,
	DealTwoPlayerHandsAction,
	DealTwoPlayerStacksAction,
	GameState,
	Seat,
	ValidationResult,
} from "../../types/index";

/**
 * 4-Player Deal
 */

export function validateDealFourPlayer({ state, action }: { state: GameState; action: DealFourPlayerAction }): ValidationResult {
	const { deck, seat } = action.payload;

	if (state.game.mode !== GAME_MODES.FOUR_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "dealFourPlayer is only valid in 4-Player mode");
	}

	const hasDealt = Object.values(state.hands).some((h) => h.length > 0);
	if (hasDealt || state.moveNumber > 0) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Cards have already been dealt");
	}

	if (deck?.length !== 52) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_DECK, "Deck must be 52 cards long to deal");
	}

	if (seat !== state.game.dealerSeat) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Only the dealer can deal cards");
	}

	return { success: true };
}

export function reduceDealFourPlayer(state: GameState, action: DealFourPlayerAction): GameState {
	const { deck } = action.payload;

	const dealer = state.players.find((p) => p.seat === state.game.dealerSeat);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	const hasDealt = Object.values(state.hands).some((h) => h.length > 0);
	if (hasDealt || state.moveNumber > 0) return state;

	const finalDeck = deck?.length === 52 ? deck : shuffleDeck(createDeck());

	const hands = dealFourPlayer({
		deck: finalDeck,
		dealerSeat: dealer.seat,
	});

	const ghoptes = detectGhopte({
		hands,
		dealerSeat: dealer.seat,
	});

	if (ghoptes && ghoptes.length > 0) {
		const activeGhopte = ghoptes.find((g) => !g.resolved) ?? ghoptes[0];
		if (!activeGhopte) return state;

		return {
			...state,
			hands,
			ghoptes,
			moveNumber: 0,
			trick: {
				number: 1,
				playNumber: 0,
				leadSuit: parseCard(activeGhopte.card).suit,
				isGhopte: true,
				cards: [],
			},
			moveDetail: {
				seat: null,
				card: null,
				makesTurup: false,
			},
			nextMoveSeat: activeGhopte.seat,
		};
	}

	// Normal 4P start (no Ghopte)
	const firstTurnPos = ((dealer.seat + 1) % 4) as Seat;

	return {
		...state,
		hands,
		moveNumber: 0,
		trick: {
			number: 1,
			playNumber: 0,
			leadSuit: null,
			isGhopte: false,
			cards: [],
		},
		moveDetail: {
			seat: null,
			card: null,
			makesTurup: false,
		},
		nextMoveSeat: firstTurnPos,
	};
}

/**
 * 2-Player Hands Deal
 */

export function validateDealTwoPlayerHands({
	state,
	action,
}: {
	state: GameState;
	action: DealTwoPlayerHandsAction;
}): ValidationResult {
	const { deck, seat } = action.payload;

	if (state.game.mode !== GAME_MODES.TWO_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "dealTwoPlayerHands is only valid in 2-Player mode");
	}

	const hasDealt = Object.values(state.hands).some((h) => h.length > 0);
	if (hasDealt || state.moveNumber > 0) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Hand cards have already been dealt");
	}

	if (deck?.length !== 52) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_DECK, "Deck must be 52 cards long to deal");
	}

	if (seat !== state.game.dealerSeat) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Only the dealer can deal cards");
	}

	return { success: true };
}

export function reduceDealTwoPlayerHands(state: GameState, action: DealTwoPlayerHandsAction): GameState {
	const { deck } = action.payload;

	const dealer = state.players.find((p) => p.seat === state.game.dealerSeat);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	const hasDealt = Object.values(state.hands).some((h) => h.length > 0);
	if (hasDealt || state.moveNumber > 0) return state;
	if (state.players.length !== 2) return state;

	const finalDeck = deck?.length === 52 ? deck : shuffleDeck(createDeck());

	const { hands } = dealTwoPlayer({
		deck: finalDeck,
		dealerSeat: dealer.seat,
	});

	const nonDealerSeat = ((dealer.seat + 1) % 2) as Seat;

	return {
		...state,
		hands,
		moveNumber: 0,
		trick: {
			number: 1,
			playNumber: 0,
			leadSuit: null,
			isGhopte: false,
			cards: [],
		},
		moveDetail: {
			seat: null,
			card: null,
			makesTurup: false,
		},
		nextMoveSeat: nonDealerSeat,
	};
}

/**
 * 2-Player Stacks Deal
 */

export function validateDealTwoPlayerStacks({
	state,
	action,
}: {
	state: GameState;
	action: DealTwoPlayerStacksAction;
}): ValidationResult {
	const { deck, seat } = action.payload;

	if (state.game.mode !== GAME_MODES.TWO_PLAYER) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "dealTwoPlayerStacks is only valid in 2-Player mode");
	}

	if (seat !== state.game.dealerSeat) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Only the dealer can deal stacks");
	}

	const hasDealtHands = Object.values(state.hands).some((h) => h.length > 0);
	if (!hasDealtHands) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Hands must be dealt before dealing stacks");
	}

	if (state.game.turup === null) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Turup must be declared before dealing stacks");
	}

	const hasDealtStacks = Object.values(state.stacks).some((pStacks) =>
		pStacks.some((s) => s.faceUpCard !== null || s.hiddenCards.length > 0),
	);
	if (hasDealtStacks) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Stacks have already been dealt");
	}

	if (deck && deck.length !== 40 && deck.length !== 52) {
		return createValidationError(
			ENGINE_ERROR_CODES.INVALID_DECK,
			"Deck must contain either 40 remaining cards or 52 full cards to deal stacks",
		);
	}

	return { success: true };
}

export function reduceDealTwoPlayerStacks(state: GameState, action: DealTwoPlayerStacksAction): GameState {
	const { deck } = action.payload;

	const dealer = state.players.find((p) => p.seat === state.game.dealerSeat);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	if (state.players.length !== 2) return state;

	let remainingDeck: readonly Card[];
	if (deck && deck.length === 40) {
		remainingDeck = deck;
	} else {
		remainingDeck = getRemainingCards2P(state, deck);
	}

	const stacks = create2PStacks({ remainingDeck, dealerSeat: dealer.seat });
	const nonDealerSeat = ((dealer.seat + 1) % 2) as Seat;

	return {
		...state,
		stacks,
		nextMoveSeat: nonDealerSeat,
	};
}

