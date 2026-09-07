import { createDeck } from "../src/core/deck";
import { Game, parseCard } from "../src";
import { describe, expect, it } from "vitest";

const deck = createDeck();

describe("4-Player Game Mode", () => {
	it("should initialize a 4-player game with 4 players and deal 13 cards each", () => {
		const game = Game.create({
			id: "game-1",
			mode: "4P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		}) as Game;

		expect(game instanceof Game).toBe(true);

		const dealRes = game.deal({ deck, playerPosition: 0 });
		expect(dealRes.success).toBe(true);

		const hand1 = game.state.hands.p1;
		const hand2 = game.state.hands.p2;
		const hand3 = game.state.hands.p3;
		const hand4 = game.state.hands.p4;

		expect(hand1?.length).toBe(13);
		expect(hand2?.length).toBe(13);
		expect(hand3?.length).toBe(13);
		expect(hand4?.length).toBe(13);
	});

	it("should return validation error with invalid player count", () => {
		const result = Game.create({
			id: "game-err",
			mode: "4P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
			],
		});
		expect("success" in result && result.success).toBe(false);
	});

	it("should enforce strict follow-suit validation", () => {
		const game = Game.create({
			id: "game-2",
			mode: "4P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		}) as Game;
		game.deal({ deck, playerPosition: 0 });

		const turnP = game.currentPlayer;
		if (!turnP) return;

		const hand = game.state.hands[turnP.id] ?? [];
		const leadCard = hand[0];
		if (!leadCard) return;

		const playRes = game.playCard({ playerPosition: turnP.position, card: leadCard });
		expect(playRes.success).toBe(true);

		const nextP = game.currentPlayer;
		if (!nextP) return;

		const nextHand = game.state.hands[nextP.id] ?? [];
		const leadSuit = game.currentTrick.leadSuit;
		if (!leadSuit) return;

		const matchingCard = nextHand.find((c) => parseCard(c).suit === leadSuit);
		const nonMatchingCard = nextHand.find((c) => parseCard(c).suit !== leadSuit);

		if (matchingCard && nonMatchingCard) {
			const illegalRes = game.playCard({
				playerPosition: nextP.position,
				card: nonMatchingCard,
			});
			expect(illegalRes.success).toBe(false);
			if (!illegalRes.success) {
				expect(illegalRes.error.code).toBe("MUST_FOLLOW_SUIT");
			}
		}
	});

	it("should initialize game with Turup as null before void suit play", () => {
		const game = Game.create({
			id: "game-3",
			mode: "4P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		}) as Game;
		game.deal({ deck, playerPosition: 0 });

		expect(game.currentTurup).toBeNull();
	});

	it("should start in DEAL phase and allow dealer to deal", () => {
		const game = Game.create({
			id: "game-deal",
			mode: "4P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		}) as Game;

		expect(game.phase).toBe("DEAL");

		const nonDealerDeal = game.deal({ deck, playerPosition: 1 });
		expect(nonDealerDeal.success).toBe(false);

		const dealRes = game.deal({ deck, playerPosition: 0 });
		expect(dealRes.success).toBe(true);
		expect(game.phase).not.toBe("DEAL");
	});
});
