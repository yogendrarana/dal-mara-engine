import { describe, expect, it } from "vitest";
import { Engine } from "../src/engine";
import { DalMaraError } from "../src/types";

describe("4-Player Game Mode", () => {
	it("should initialize a 4-player game with 4 players and deal 13 cards each", () => {
		const game = Engine.createGame({
			id: "game-1",
			mode: "4P",
			seed: 99999,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});

		const startRes = game.start();
		expect(startRes.success).toBe(true);

		const hand1 = game.state.hands.p1;
		const hand2 = game.state.hands.p2;
		const hand3 = game.state.hands.p3;
		const hand4 = game.state.hands.p4;

		expect(hand1?.length).toBe(13);
		expect(hand2?.length).toBe(13);
		expect(hand3?.length).toBe(13);
		expect(hand4?.length).toBe(13);
	});

	it("should reject creation with invalid player count", () => {
		expect(() => {
			Engine.createGame({
				id: "game-err",
				mode: "4P",
				players: [
					{ id: "p1", name: "Alice" },
					{ id: "p2", name: "Bob" },
				],
			});
		}).toThrow(DalMaraError);
	});

	it("should enforce strict follow-suit validation", () => {
		const game = Engine.createGame({
			id: "game-2",
			mode: "4P",
			seed: 42,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});
		game.start();

		const turnP = game.currentPlayer;
		if (!turnP) return;

		const hand = game.state.hands[turnP.id] ?? [];
		const leadCard = hand[0];
		if (!leadCard) return;

		const playRes = game.playCard({ playerId: turnP.id, cardId: leadCard.id });
		expect(playRes.success).toBe(true);

		const nextP = game.currentPlayer;
		if (!nextP) return;

		const nextHand = game.state.hands[nextP.id] ?? [];
		const leadSuit = game.currentTrick.leadSuit;
		if (!leadSuit) return;

		const matchingCard = nextHand.find((c) => c.suit === leadSuit);
		const nonMatchingCard = nextHand.find((c) => c.suit !== leadSuit);

		if (matchingCard && nonMatchingCard) {
			const illegalRes = game.playCard({
				playerId: nextP.id,
				cardId: nonMatchingCard.id,
			});
			expect(illegalRes.success).toBe(false);
			if (!illegalRes.success) {
				expect(illegalRes.error.code).toBe("MUST_FOLLOW_SUIT");
			}
		}
	});

	it("should initialize game with Turup as null before void suit play", () => {
		const game = Engine.createGame({
			id: "game-3",
			mode: "4P",
			seed: 100,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});
		game.start();

		expect(game.currentTurup).toBeNull();
	});
});
