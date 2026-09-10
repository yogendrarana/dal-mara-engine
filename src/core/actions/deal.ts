import { parseCard } from "../card";
import { DalMaraError } from "../errors";
import { createDeck, shuffleDeck } from "../deck";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES } from "../const";
import { dealFourPlayer, detectGhopte } from "../rules/four-player";
import { dealTwoPlayer, create2PStacks } from "../rules/two-player";
import type { DealAction, GameState, Seat, ValidationResult } from "../../types/index";

// Validation

export function validateDeal({ state, action }: { state: GameState; action: DealAction }): ValidationResult {
	const { deck, seat } = action.payload;

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

// Reducer (4-Player)

export function reduceDeal4P(state: GameState, action: DealAction): GameState {
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

// Reducer (2-Player)

export function reduceDeal2P(state: GameState, action: DealAction): GameState {
	const { deck } = action.payload;

	const dealer = state.players.find((p) => p.seat === state.game.dealerSeat);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	const hasDealt = Object.values(state.hands).some((h) => h.length > 0);
	if (hasDealt || state.moveNumber > 0) return state;
	if (state.players.length !== 2) return state;

	const finalDeck = deck?.length === 52 ? deck : shuffleDeck(createDeck());

	const { hands, remainingDeck } = dealTwoPlayer({
		deck: finalDeck,
		dealerSeat: dealer.seat,
	});

	const stacks = create2PStacks({ remainingDeck, dealerSeat: dealer.seat });
	const nonDealerSeat = ((dealer.seat + 1) % 2) as Seat;

	return {
		...state,
		hands,
		stacks,
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
