import { validateFollowSuit } from "../rules/four-player";
import { validate2PFollowSuit } from "../rules/two-player";

import type {
	Action,
	Card,
	EngineError,
	GameState,
	ValidationResult,
} from "../types/index";

import {
	ACTION_TYPES,
	ENGINE_ERROR_CODES,
	GAME_MODES,
	GAME_PHASES,
	RANKS,
} from "../types/index";

// create error helper
export function createError(
	code: EngineError["code"],
	message: string,
	details?: Record<string, unknown>,
): ValidationResult {
	return {
		success: false,
		error: details ? { code, message, details } : { code, message },
	};
}

// validate action
export function validateAction(
	state: GameState,
	action: Action,
): ValidationResult {
	switch (action.type) {
		case ACTION_TYPES.CREATE_GAME:
			return { success: true };

		case ACTION_TYPES.JOIN_PLAYER: {
			if (state.phase !== GAME_PHASES.LOBBY) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_PHASE,
					"Cannot join players after game lobby phase",
				);
			}

			const maxPlayers = state.mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;
			if (state.players.length >= maxPlayers) {
				return createError(
					ENGINE_ERROR_CODES.GAME_FULL,
					`Game is full (max ${maxPlayers} players)`,
				);
			}

			if (state.players.some((p) => p.id === action.payload.id)) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_ACTION,
					`Player with ID ${action.payload.id} already in game`,
				);
			}

			return { success: true };
		}

		case ACTION_TYPES.START_GAME: {
			if (state.phase !== GAME_PHASES.LOBBY) {
				return createError(
					ENGINE_ERROR_CODES.GAME_ALREADY_STARTED,
					"Game has already started",
				);
			}

			const requiredPlayers = state.mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;
			if (state.players.length !== requiredPlayers) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_PLAYER_COUNT,
					`Game requires exactly ${requiredPlayers} players to start (currently ${state.players.length})`,
				);
			}

			return { success: true };
		}

		case ACTION_TYPES.DECLARE_TURUP: {
			if (state.phase !== GAME_PHASES.TURUP_DECLARATION) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_PHASE,
					"Cannot declare Turup outside TURUP_DECLARATION phase",
				);
			}

			if (state.mode !== GAME_MODES.TWO_PLAYER) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_ACTION,
					"Turup declaration action is only valid in 2-Player mode",
				);
			}

			if (state.currentTurnPlayerId !== action.payload.playerId) {
				return createError(
					ENGINE_ERROR_CODES.NOT_PLAYER_TURN,
					"It is not your turn to declare Turup",
				);
			}

			return { success: true };
		}

		case ACTION_TYPES.PICKUP_TURUP_CARD: {
			if (state.mode !== GAME_MODES.TWO_PLAYER) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_ACTION,
					"Pickup Turup action is only valid in 2-Player mode",
				);
			}
			const stacks = state.stacks2P[action.payload.playerId];
			if (!stacks) {
				return createError(
					ENGINE_ERROR_CODES.PLAYER_NOT_FOUND,
					"Player stacks not found",
				);
			}

			const stackId =
				"stackId" in action.payload ? action.payload.stackId : undefined;
			const stackIndex =
				"stackIndex" in action.payload ? action.payload.stackIndex : undefined;

			let targetStack = null;
			if (stackId) {
				targetStack = stacks.find((s) => s.id === stackId);
			} else if (
				stackIndex !== undefined &&
				stackIndex >= 0 &&
				stackIndex < stacks.length
			) {
				targetStack = stacks[stackIndex];
			}

			if (
				!targetStack?.faceUpCard ||
				targetStack.faceUpCard.suit !== state.currentTurup
			) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_ACTION,
					"Target stack card is not face up or is not Turup suit",
				);
			}
			return { success: true };
		}

		case ACTION_TYPES.SUBMIT_GHOPTE_CARD:
		case ACTION_TYPES.PLAY_CARD: {
			if (
				state.phase !== GAME_PHASES.PLAYING &&
				state.phase !== GAME_PHASES.GHOPTE
			) {
				return createError(
					ENGINE_ERROR_CODES.INVALID_PHASE,
					"Cannot play cards outside PLAYING or GHOPTE phase",
				);
			}

			if (state.currentTurnPlayerId !== action.payload.playerId) {
				return createError(
					ENGINE_ERROR_CODES.NOT_PLAYER_TURN,
					`Not turn for player ${action.payload.playerId}`,
				);
			}

			const hand = state.hands[action.payload.playerId] ?? [];
			const stacks = state.stacks2P[action.payload.playerId] ?? [];

			let cardToPlay: Card | null = null;
			const fromStackIndex =
				"fromStackIndex" in action.payload
					? action.payload.fromStackIndex
					: undefined;
			const stackId =
				"stackId" in action.payload ? action.payload.stackId : undefined;

			if (
				state.mode === GAME_MODES.TWO_PLAYER &&
				(stackId || fromStackIndex !== undefined)
			) {
				let targetStack = null;
				if (stackId) {
					targetStack = stacks.find((s) => s.id === stackId);
				} else if (
					fromStackIndex !== undefined &&
					fromStackIndex >= 0 &&
					fromStackIndex < stacks.length
				) {
					targetStack = stacks[fromStackIndex];
				}

				if (
					!targetStack?.faceUpCard ||
					targetStack.faceUpCard.id !== action.payload.cardId
				) {
					return createError(
						ENGINE_ERROR_CODES.CARD_NOT_OWNED,
						"Card is not face up on specified stack",
					);
				}

				cardToPlay = targetStack.faceUpCard;
			} else {
				cardToPlay = hand.find((c) => c.id === action.payload.cardId) ?? null;

				if (!cardToPlay && state.mode === GAME_MODES.TWO_PLAYER) {
					const matchingStack = stacks.find(
						(s) => s.faceUpCard?.id === action.payload.cardId,
					);
					if (matchingStack?.faceUpCard) {
						cardToPlay = matchingStack.faceUpCard;
					}
				}
			}

			if (!cardToPlay) {
				return createError(
					ENGINE_ERROR_CODES.CARD_NOT_OWNED,
					`Player does not own or cannot access card ${action.payload.cardId}`,
				);
			}

			// In Ghopte phase:
			// Non-declarers guess the face-down 10's suit and are NOT required to follow suit.
			// Declarer must play their Ghopte 10.
			if (state.phase === GAME_PHASES.GHOPTE && state.ghopteState) {
				const activeGhopte =
					state.ghopteState.ghoptes[state.ghopteState.activeIndex];
				if (
					activeGhopte &&
					activeGhopte.declarerId === action.payload.playerId
				) {
					if (
						cardToPlay.suit !== activeGhopte.suit ||
						cardToPlay.rank !== RANKS.TEN
					) {
						return createError(
							ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION,
							"Declarer must play the declared Ghopte 10 card",
						);
					}
				} else {
					// Guessing player cannot throw their own pending Ghopte 10 for another player's Ghopte
					const isPendingOwnGhopte = state.ghopteState.ghoptes.some(
						(g) =>
							g.declarerId === action.payload.playerId &&
							!g.resolved &&
							g.tenCard.id === cardToPlay.id,
					);
					if (isPendingOwnGhopte) {
						return createError(
							ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION,
							"Cannot play your own pending Ghopte 10 card while guessing another player's Ghopte",
						);
					}
				}
				// Guessing players can play any card from hand
				return { success: true };
			}

			// Follow-suit validation for standard PLAYING phase
			const leadSuit = state.currentTrick.leadSuit;

			if (state.mode === GAME_MODES.FOUR_PLAYER) {
				const followsSuit = validateFollowSuit(hand, cardToPlay, leadSuit);

				if (!followsSuit) {
					return createError(
						ENGINE_ERROR_CODES.MUST_FOLLOW_SUIT,
						`Must follow lead suit (${leadSuit}) when holding matching cards`,
					);
				}
			} else {
				const followsSuit = validate2PFollowSuit(
					hand,
					stacks,
					cardToPlay,
					leadSuit,
				);

				if (!followsSuit) {
					return createError(
						ENGINE_ERROR_CODES.MUST_FOLLOW_SUIT,
						`Must follow lead suit (${leadSuit}) when holding matching cards in hand or face-up stacks`,
					);
				}
			}

			return { success: true };
		}

		default:
			return createError(
				ENGINE_ERROR_CODES.INVALID_ACTION,
				"Unknown action type",
			);
	}
}
