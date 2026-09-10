import { createValidationError } from "./errors";
import { ENGINE_ERROR_CODES, GAME_MODES } from "./const";
import type { GameMode, Player, Seat, ValidationResult } from "../types/index";

/**
 * Validate game creation options.
 */
export function validateCreateGame(options: { mode: GameMode; players: readonly Player[]; dealerSeat: Seat }): ValidationResult {
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

	// check seats (0 to expectedCount - 1)
	const seats = new Set<number>();
	for (const p of options.players) {
		if (typeof p.seat !== "number" || p.seat < 0 || p.seat >= expectedCount) {
			return createValidationError(
				ENGINE_ERROR_CODES.INVALID_CONFIGURATION,
				`Player has invalid seat '${p.seat}'. Seats must be between 0 and ${expectedCount - 1}`,
			);
		}

		if (seats.has(p.seat)) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_CONFIGURATION, `Duplicate seat '${p.seat}' found`);
		}

		seats.add(p.seat);
	}

	// verify all seats are occupied
	for (let i = 0; i < expectedCount; i++) {
		if (!seats.has(i)) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_CONFIGURATION, `Seat ${i} is not occupied`);
		}
	}

	// validate dealerSeat
	if (typeof options.dealerSeat !== "number" || !seats.has(options.dealerSeat)) {
		return createValidationError(
			ENGINE_ERROR_CODES.INVALID_DEALER,
			`dealerSeat must be a valid occupied player seat (0 to ${expectedCount - 1})`,
		);
	}

	// valiate the team
	if (options.mode === GAME_MODES.FOUR_PLAYER) {
		const p0 = options.players.find((p) => p.seat === 0);
		const p1 = options.players.find((p) => p.seat === 1);
		const p2 = options.players.find((p) => p.seat === 2);
		const p3 = options.players.find((p) => p.seat === 3);

		const t0 = p0?.team ?? "02";
		const t1 = p1?.team ?? "13";
		const t2 = p2?.team ?? "02";
		const t3 = p3?.team ?? "13";

		if (t0 !== t2) {
			return createValidationError(
				ENGINE_ERROR_CODES.INVALID_CONFIGURATION,
				`Players at seats 0 and 2 must belong to the same team (got '${t0}' vs '${t2}')`,
			);
		}

		if (t1 !== t3) {
			return createValidationError(
				ENGINE_ERROR_CODES.INVALID_CONFIGURATION,
				`Players at seats 1 and 3 must belong to the same team (got '${t1}' vs '${t3}')`,
			);
		}

		if (t0 === t1 || t2 === t3) {
			return createValidationError(ENGINE_ERROR_CODES.INVALID_CONFIGURATION, "Opposing teams cannot have the same team");
		}
	}

	return { success: true };
}
