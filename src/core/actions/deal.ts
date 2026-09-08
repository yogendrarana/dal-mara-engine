import { parseCard } from "../card";
import { DalMaraError } from "../errors";
import { getCurrentTurnPlayer } from "../turn";
import { createDeck, shuffleDeck } from "../deck";
import { createValidationError } from "../errors";
import { ENGINE_ERROR_CODES, GAME_PHASES } from "../const";
import type { EventDispatcher } from "../../events/dispatcher";
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
		players: state.players,
	});

	const ghoptes = detectGhopte({
		hands,
		players: state.players,
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
			play: {
				number: 0,
				card: null,
				playerPosition: activeGhopte.playerPosition,
				isGhopte: false,
				isTurup: false,
				makesTurup: false,
			},
			trick: {
				number: 1,
				playNumber: 1,
				leadSuit: parseCard(activeGhopte.card).suit,
				leaderPosition: activeGhopte.playerPosition,
				isGhopte: true,
				cards: [],
				nextLeaderPosition: null,
				winnerPosition: null,
			},
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
		play: {
			number: 0,
			card: null,
			playerPosition: firstTurnPos,
			isGhopte: false,
			isTurup: false,
			makesTurup: false,
		},
		trick: {
			number: 1,
			playNumber: 1,
			leadSuit: null,
			leaderPosition: firstTurnPos,
			isGhopte: false,
			cards: [],
			nextLeaderPosition: null,
			winnerPosition: null,
		},
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
		players: state.players,
	});

	const stacks2P = create2PStacks({ remainingDeck, players: state.players, dealerPosition: dealer.position });
	const nonDealerPosition = ((dealer.position + 1) % 2) as PlayerPosition;

	return {
		...state,
		game: {
			...state.game,
			phase: GAME_PHASES.TURUP_DECLARATION,
		},
		hands,
		stacks2P,
		play: {
			number: 0,
			card: null,
			playerPosition: nonDealerPosition,
			isGhopte: false,
			isTurup: false,
			makesTurup: false,
		},
		trick: {
			number: 1,
			playNumber: 1,
			leadSuit: null,
			leaderPosition: nonDealerPosition,
			isGhopte: false,
			cards: [],
			nextLeaderPosition: null,
			winnerPosition: null,
		},
	};
}

// Event Emission

export function emitDealEvents({
	nextState,
	emitter,
}: {
	prevState?: GameState;
	state?: GameState;
	nextState: GameState;
	action?: DealAction;
	emitter: EventDispatcher;
}): void {
	emitter.emit("CardsDealt", { phase: nextState.game.phase });

	if (nextState.game.phase === GAME_PHASES.GHOPTE) {
		emitter.emit("GhopteStarted", {
			ghoptes: nextState.ghoptes,
		});
	} else if (
		(nextState.game.phase === GAME_PHASES.PLAYING || nextState.game.phase === GAME_PHASES.TURUP_DECLARATION) &&
		getCurrentTurnPlayer(nextState)
	) {
		const currentPlayer = getCurrentTurnPlayer(nextState);
		if (currentPlayer) {
			emitter.emit("TurnStarted", {
				playerId: currentPlayer.id,
			});
		}
	}
}
