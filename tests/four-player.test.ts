import { createDeck, createGame, deal, playCard, getCurrentPlayer, getLegalMoves, parseCard } from "../src";
import { describe, expect, it } from "vitest";

const deck = createDeck();

describe("4-Player Game Mode", () => {
	it("should initialize a 4-player game with 4 players and deal 13 cards each", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		});

		expect(gameResult.success).toBe(true);
		if (!gameResult.success) return;

		const dealRes = deal(gameResult.state, { deck, playerPosition: 0 });
		expect(dealRes.success).toBe(true);
		if (!dealRes.success) return;

		const hand1 = dealRes.state.hands.p1;
		const hand2 = dealRes.state.hands.p2;
		const hand3 = dealRes.state.hands.p3;
		const hand4 = dealRes.state.hands.p4;

		expect(hand1?.length).toBe(13);
		expect(hand2?.length).toBe(13);
		expect(hand3?.length).toBe(13);
		expect(hand4?.length).toBe(13);
	});

	it("should return validation error with invalid player count", () => {
		const result = createGame({
			mode: "4p",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
			],
		});
		expect(result.success).toBe(false);
	});

	it("should enforce strict follow-suit validation", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		});
		if (!gameResult.success) return;

		const dealRes = deal(gameResult.state, { deck, playerPosition: 0 });
		if (!dealRes.success) return;

		let state = dealRes.state;
		const turnP = getCurrentPlayer(state);
		if (!turnP) return;

		const hand = state.hands[turnP.id] ?? [];
		const leadCard = hand[0];
		if (!leadCard) return;

		const playRes = playCard(state, { playerPosition: turnP.position, card: leadCard });
		if (!playRes.success) return;
		state = playRes.state;

		const nextP = getCurrentPlayer(state);
		if (!nextP) return;

		const nextHand = state.hands[nextP.id] ?? [];
		const leadSuit = state.trick.leadSuit;
		if (!leadSuit) return;

		const matchingCard = nextHand.find((c) => parseCard(c).suit === leadSuit);
		const nonMatchingCard = nextHand.find((c) => parseCard(c).suit !== leadSuit);

		if (matchingCard && nonMatchingCard) {
			const illegalRes = playCard(state, {
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
		const gameResult = createGame({
			mode: "4p",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		});
		if (!gameResult.success) return;

		const dealRes = deal(gameResult.state, { deck, playerPosition: 0 });
		if (!dealRes.success) return;

		expect(dealRes.state.game.turup).toBeNull();
	});

	it("should start in DEAL phase and allow dealer to deal", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		});
		if (!gameResult.success) return;

		expect(gameResult.state.game.phase).toBe("DEAL");

		const nonDealerDeal = deal(gameResult.state, { deck, playerPosition: 1 });
		expect(nonDealerDeal.success).toBe(false);

		const dealRes = deal(gameResult.state, { deck, playerPosition: 0 });
		expect(dealRes.success).toBe(true);
		if (dealRes.success) {
			expect(dealRes.state.game.phase).not.toBe("DEAL");
		}
	});
});
