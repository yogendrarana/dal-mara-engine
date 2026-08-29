import type { Card } from "../types/index";

/**
 *
 * @param state
 * @returns
 *
 * @note
 * Pure Mulberry32 PRNG generator.
 * Returns pseudo-random float between 0 (inclusive) and 1 (exclusive) and next state.
 */

export function mulberry32(state: number): {
	value: number;
	nextState: number;
} {
	let t = (state + 0x6d2b79f5) | 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	return { value, nextState: (state + 1) | 0 };
}

/**
 *
 * @param deck
 * @param rngState
 * @returns
 *
 * @note
 * Seeded Fisher-Yates shuffle.
 * Returns new shuffled deck array and updated RNG state.
 * RNG = Random Numer Generator
 */

export function shuffleDeck({ deck, rngState }: { deck: readonly Card[]; rngState: number }): {
	shuffled: Card[];
	nextRngState: number;
} {
	const result = [...deck];
	let currentRngState = rngState;

	for (let i = result.length - 1; i > 0; i--) {
		const { value, nextState } = mulberry32(currentRngState);

		currentRngState = nextState;
		const j = Math.floor(value * (i + 1));
		const temp = result[i];
		result[i] = result[j];
		result[j] = temp;
	}

	return { shuffled: result, nextRngState: currentRngState };
}
