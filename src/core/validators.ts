import { ACTION_TYPES, ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES, RANKS } from "./const";

import { createValidationError } from "./errors";
import { validateFollowSuit } from "./rules/four-player";
import { validate2PFollowSuit } from "./rules/two-player";
import type { Action, Card, GameMode, GameState, Player, ValidationResult } from "../types/index";

/**
 * Validate game creation options.
 */
export function validateCreateGame(options: {
	id: string;
	mode: GameMode;
	players: readonly Player[];
	dealerId: string;
}): ValidationResult {
	if (!options.id || typeof options.id !== "string" || options.id.trim() === "") {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_GAME_ID, "Game id is required to create a game");
	}

	if (!options.mode || !Object.values(GAME_MODES).includes(options.mode)) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_MODE, "Game mode is required to create a game");
	}

	if (!options.players || !Array.isArray(options.players)) {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_PLAYERS, "Players array is required to create a game");
	}

	const expectedCount = options.mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;
	if (options.players.length !== expectedCount) {
		return createValidationError(
			ENGINE_ERROR_CODES.INVALID_PLAYER_COUNT,
			`Game mode '${options.mode}' requires exactly ${expectedCount} players, got ${options.players.length}`,
			{
				mode: options.mode,
				expected: expectedCount,
				received: options.players.length,
			},
		);
	}

	// check for duplicate player IDs
	const playerIds = new Set<string>();
	for (const p of options.players) {
		if (!p.id || typeof p.id !== "string" || p.id.trim() === "") {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_PLAYERS, "All players must have a valid non-empty, string id");
		}

		if (playerIds.has(p.id)) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_PLAYERS, `Duplicate player id '${p.id}' found`);
		}

		playerIds.add(p.id);
	}

	// check positions / seats (0 to expectedCount - 1)
	const positions = new Set<number>();
	for (const p of options.players) {
		if (typeof p.position !== "number" || p.position < 0 || p.position >= expectedCount) {
			return createValidationError(
				ENGINE_ERROR_CODES.INVALID_CONFIGURATION,
				`Player '${p.id}' has invalid position '${p.position}'. Positions must be between 0 and ${expectedCount - 1}`,
			);
		}

		if (positions.has(p.position)) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_CONFIGURATION, `Duplicate position '${p.position}' found`);
		}

		positions.add(p.position);
	}

	if (options.mode === GAME_MODES.FOUR_PLAYER) {
		if (options.players.some((p) => !p.team)) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_PLAYERS, "All players must have a valid non-empty, string team");
		}

		const p0 = options.players.find((p) => p.position === 0);
		const p1 = options.players.find((p) => p.position === 1);
		const p2 = options.players.find((p) => p.position === 2);
		const p3 = options.players.find((p) => p.position === 3);

		const t0 = p0.team;
		const t1 = p1.team;
		const t2 = p2.team;
		const t3 = p3?.team;

		if (t0 !== t2) {
			return createValidationError(
				ENGINE_ERROR_CODES.INVALID_CONFIGURATION,
				`Players at positions 0 ('${p0.id}') and 2 ('${p2.id}') must belong to the same team (got '${t0}' vs '${t2}')`,
			);
		}

		if (t1 !== t3) {
			return createValidationError(
				ENGINE_ERROR_CODES.INVALID_CONFIGURATION,
				`Players at positions 1 ('${p1.id}') and 3 ('${p3?.id}') must belong to the same team (got '${t1}' vs '${t3}')`,
			);
		}

		if (t0 === t1 || t2 === t3) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_CONFIGURATION, "Opposing teams cannot have the same team");
		}
	}

	// verify all seats are occupied
	for (let i = 0; i < expectedCount; i++) {
		if (!positions.has(i)) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_CONFIGURATION, `Position ${i} is not occupied`);
		}
	}

	// validate dealerId
	if (!options.dealerId || typeof options.dealerId !== "string") {
		return createValidationError(ENGINE_ERROR_CODES.INVALID_DEALER, "dealerId is required to create a game");
	}

	if (!playerIds.has(options.dealerId)) {
		return createValidationError(
			ENGINE_ERROR_CODES.INVALID_DEALER,
			`dealerId '${options.dealerId}' does not match any player in the game`,
		);
	}

	return { success: true };
}

/**
 * Validate actions during game lifecycle.
 */
export function validateAction(state: GameState, action: Action): ValidationResult {
	switch (action.type) {
		case ACTION_TYPES.DEAL: {
			const { deck, playerId } = action.payload;

			if (state.phase !== GAME_PHASES.DEAL) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot deal cards outside DEAL phase");
			}

			if (deck?.length !== 52) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_DECK, "Deck must be 52 cards long to deal");
			}

			if (playerId !== state.dealerId) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Only the dealer can deal cards");
			}

			return { success: true };
		}

		case ACTION_TYPES.DECLARE_TURUP: {
			if (state.mode !== GAME_MODES.TWO_PLAYER) {
				return createValidationError(
					ENGINE_ERROR_CODES.INVALID_ACTION,
					"Turup declaration action is only valid in 2-Player mode",
				);
			}

			if (state.phase !== GAME_PHASES.TURUP_DECLARATION) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot declare Turup outside TURUP_DECLARATION phase");
			}

			if (state.currentTurnPlayerId !== action.payload.playerId) {
				return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, "It is not your turn to declare Turup");
			}

			return { success: true };
		}

		case ACTION_TYPES.PICKUP_TURUP_CARD: {
			const { cardId } = action.payload;
			if (state.mode !== GAME_MODES.TWO_PLAYER) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Pickup Turup action is only valid in 2-Player mode");
			}

			const stacks = state.stacks2P[action.payload.playerId];
			if (!stacks) {
				return createValidationError(ENGINE_ERROR_CODES.STACK_NOT_FOUND, "Player stacks not found");
			}

			const targetStack = stacks.find((s) => s.faceUpCard?.id === cardId);

			if (!targetStack) {
				return createValidationError(ENGINE_ERROR_CODES.STACK_NOT_FOUND, "Target stack not found");
			}

			if (!targetStack?.faceUpCard || targetStack.faceUpCard.suit !== state.currentTurup) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Target stack card is not face up or is not Turup suit");
			}

			return { success: true };
		}

		case ACTION_TYPES.PLAY_GHOPTE: {
			const { playerId, cardId } = action.payload;

			if (state.mode !== GAME_MODES.FOUR_PLAYER) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Ghopte is only valid in 4-Player mode");
			}

			if (state.phase !== GAME_PHASES.GHOPTE) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "PLAY_GHOPTE action is only valid during GHOPTE phase");
			}

			if (state.currentTurnPlayerId !== playerId) {
				return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, `Not turn for player ${playerId}`);
			}

			const hand = state.hands[playerId] ?? [];
			const cardToPlay = hand.find((c) => c.id === cardId) ?? null;

			if (!cardToPlay) {
				return createValidationError(ENGINE_ERROR_CODES.CARD_NOT_OWNED, `Player does not own card ${cardId}`);
			}

			if (state.ghopteState) {
				const unresolvedGhoptes = [...state.ghopteState.ghoptes].filter((g) => !g.resolved).sort((a, b) => a.order - b.order);
				const activeGhopte = unresolvedGhoptes[0];

				if (!activeGhopte) {
					return createValidationError(ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION, "Active ghopte is not found.");
				}

				const isPlayerGhopteDeclarer = activeGhopte.declarerId === playerId;

				if (isPlayerGhopteDeclarer) {
					if (cardToPlay.suit !== activeGhopte.suit || cardToPlay.rank !== RANKS.TEN) {
						return createValidationError(
							ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION,
							"Declarer must play the declared Ghopte 10 card",
						);
					}
				}

				if (!isPlayerGhopteDeclarer) {
					// player cannot throw their own pending Ghopte 10 for another player's Ghopte
					const isPendingOwnGhopte = state.ghopteState.ghoptes.some(
						(g) => g.declarerId === playerId && !g.resolved && g.tenCard.id === cardToPlay.id,
					);

					if (isPendingOwnGhopte) {
						return createValidationError(
							ENGINE_ERROR_CODES.INVALID_GHOPTE_SUBMISSION,
							"Cannot play your own pending Ghopte 10 card while guessing another player's Ghopte",
						);
					}
				}
			}

			return { success: true };
		}

		case ACTION_TYPES.PLAY_CARD: {
			const { playerId, cardId } = action.payload;

			if (state?.ghopteState?.ghoptes.some((g) => !g.resolved)) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot play card while there are unresolved Ghoptes");
			}

			if (state.phase !== GAME_PHASES.PLAYING) {
				return createValidationError(ENGINE_ERROR_CODES.INVALID_PHASE, "Cannot play cards outside PLAYING phase");
			}

			if (state.currentTurnPlayerId !== playerId) {
				return createValidationError(ENGINE_ERROR_CODES.NOT_PLAYER_TURN, `Not turn for player ${playerId}`);
			}

			const hand = state.hands[playerId] ?? [];
			const stacks = state.stacks2P[playerId] ?? [];

			let cardToPlay: Card | null = null;

			if (state.mode === GAME_MODES.TWO_PLAYER) {
				// first, search the card in hand
				cardToPlay = hand.find((c) => c.id === cardId) ?? null;

				// if card is not found the search among the stack
				if (!cardToPlay) {
					const matchingStack = stacks.find((s) => s.faceUpCard?.id === cardId);
					if (matchingStack?.faceUpCard) {
						cardToPlay = matchingStack.faceUpCard;
					}
				}
			} else {
				cardToPlay = hand.find((c) => c.id === cardId) ?? null;
			}

			if (!cardToPlay) {
				return createValidationError(ENGINE_ERROR_CODES.CARD_NOT_OWNED, `Player does not own or cannot access card ${cardId}`);
			}

			// follow-suit validation for standard PLAYING phase
			const leadSuit = state.currentTrick.leadSuit;

			if (state.mode === GAME_MODES.FOUR_PLAYER) {
				const followsSuit = validateFollowSuit({ hand, cardToPlay, leadSuit });

				if (!followsSuit) {
					return createValidationError(
						ENGINE_ERROR_CODES.MUST_FOLLOW_SUIT,
						`Must follow lead suit (${leadSuit}) when holding matching cards`,
					);
				}
			}

			if (state.mode === GAME_MODES.TWO_PLAYER) {
				const followsSuit = validate2PFollowSuit({
					hand,
					stacks,
					cardToPlay,
					leadSuit,
				});

				if (!followsSuit) {
					return createValidationError(
						ENGINE_ERROR_CODES.MUST_FOLLOW_SUIT,
						`Must follow lead suit (${leadSuit}) when holding matching cards in hand or face-up stacks`,
					);
				}
			}

			return { success: true };
		}

		default:
			return createValidationError(ENGINE_ERROR_CODES.INVALID_ACTION, "Unknown action type");
	}
}
