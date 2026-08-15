import { describe, expect, it } from "vitest";
import {
	compareCardRanks,
	createCard,
	createDeck,
	parseCardId,
} from "../src/cards/deck";
import { shuffleDeck } from "../src/cards/shuffle";

describe("Card & Deck System", () => {
	it("should generate 52 unique cards in a standard deck", () => {
		const deck = createDeck();
		expect(deck.length).toBe(52);
		const cardIds = new Set(deck.map((c) => c.id));
		expect(cardIds.size).toBe(52);
	});

	it("should rank cards correctly (Ace highest, 2 lowest)", () => {
		const ace = createCard("spades", "A");
		const king = createCard("spades", "K");
		const ten = createCard("spades", "10");
		const two = createCard("spades", "2");

		expect(compareCardRanks(ace, king)).toBeGreaterThan(0);
		expect(compareCardRanks(king, ten)).toBeGreaterThan(0);
		expect(compareCardRanks(ten, two)).toBeGreaterThan(0);
	});

	it("should parse card IDs correctly", () => {
		const card = parseCardId("10s");
		expect(card).not.toBeNull();
		expect(card?.rank).toBe("10");
		expect(card?.suit).toBe("spades");
	});

	it("should perform reproducible seeded PRNG shuffle", () => {
		const deck = createDeck();
		const seed = 123456;
		const res1 = shuffleDeck(deck, seed);
		const res2 = shuffleDeck(deck, seed);

		expect(res1.shuffled).toEqual(res2.shuffled);
		expect(res1.nextRngState).toEqual(res2.nextRngState);
	});
});
