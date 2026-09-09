import { parseCard } from "../card";
import { DalMaraError } from "../errors";
import { createDeck, shuffleDeck } from "../deck";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_PHASES } from "../const";
import { dealFourPlayer, detectGhopte } from "../rules/four-player";
import { dealTwoPlayer, create2PStacks } from "../rules/two-player";
import type { DealAction, GameState, PlayerPosition, ValidationResult } from "../../types/index";

// Validation

export function validateDeal({ state, action }: { state: GameState; action: DealAction }): ValidationResult {
	const { deck, playerPosition } = action.payload;

	if (state.game.phase !== GAME_PHASES.DEAL) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot deal cards outside DEAL phase");
	}

	if (deck?.length !== 52) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_DECK, "Deck must be 52 cards long to deal");
	}

	if (playerPosition !== state.game.dealerPosition) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Only the dealer can deal cards");
	}

	return { success: true };
}

// Reducer (4-Player)

export function reduceDeal4P(state: GameState, action: DealAction): GameState {
	const { deck } = action.payload;

	const dealer = state.players.find((p) => p.position === state.game.dealerPosition);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	if (state.game.phase !== GAME_PHASES.DEAL) return state;

	const finalDeck = deck?.length === 52 ? deck : shuffleDeck(createDeck());

	const hands = dealFourPlayer({
		deck: finalDeck,
		dealerPosition: dealer.position,
	});

	const ghoptes = detectGhopte({
		hands,
		dealerPosition: dealer.position,
	});

	if (ghoptes && ghoptes.length > 0) {
		const activeGhopte = ghoptes.find((g) => !g.resolved) ?? ghoptes[0];
		if (!activeGhopte) return state;

		return {
			...state,
			game: {
				...state.game,
				phase: GAME_PHASES.GHOPTE,
			},
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
				playerPosition: null,
				card: null,
				makesTurup: false,
			},
			nextMovePlayerPosition: activeGhopte.playerPosition,
		};
	}

	// Normal 4P start (no Ghopte)
	const firstTurnPos = ((dealer.position + 1) % 4) as PlayerPosition;

	return {
		...state,
		game: {
			...state.game,
			phase: GAME_PHASES.PLAYING,
		},
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
			playerPosition: null,
			card: null,
			makesTurup: false,
		},
		nextMovePlayerPosition: firstTurnPos,
	};
}

// Reducer (2-Player)

export function reduceDeal2P(state: GameState, action: DealAction): GameState {
	const { deck } = action.payload;

	const dealer = state.players.find((p) => p.position === state.game.dealerPosition);
	if (!dealer) {
		throw new DalMaraError("Cannot find the dealer in the player list.", ENGINE_ERROR_CODES.INVALID_DEALER);
	}

	if (state.game.phase !== GAME_PHASES.DEAL) return state;
	if (state.players.length !== 2) return state;

	const finalDeck = deck?.length === 52 ? deck : shuffleDeck(createDeck());

	const { hands, remainingDeck } = dealTwoPlayer({
		deck: finalDeck,
		dealerPosition: dealer.position,
	});

	const stacks = create2PStacks({ remainingDeck, dealerPosition: dealer.position });
	const nonDealerPosition = ((dealer.position + 1) % 2) as PlayerPosition;

	return {
		...state,
		game: {
			...state.game,
			phase: GAME_PHASES.TURUP_DECLARATION,
		},
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
			playerPosition: null,
			card: null,
			makesTurup: false,
		},
		nextMovePlayerPosition: nonDealerPosition,
	};
}
