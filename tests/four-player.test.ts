import { createDeck, createGame, deal, playCard, getCurrentPlayer, getLegalMoves, parseCard } from "../src";
import { describe, expect, it } from "vitest";

const deck = createDeck();

describe("4-Player Game Mode", () => {
	it("should initialize a 4-player game with 4 players and deal 13 cards each", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
				{ seat: 2, team: "red" },
				{ seat: 3, team: "blue" },
			],
		});

		expect(gameResult.success).toBe(true);
		if (!gameResult.success) return;

		const dealRes = deal(gameResult.state, { deck, seat: 0 });
		expect(dealRes.success).toBe(true);
		if (!dealRes.success) return;

		const hand1 = dealRes.state.hands[0];
		const hand2 = dealRes.state.hands[1];
		const hand3 = dealRes.state.hands[2];
		const hand4 = dealRes.state.hands[3];

		expect(hand1?.length).toBe(13);
		expect(hand2?.length).toBe(13);
		expect(hand3?.length).toBe(13);
		expect(hand4?.length).toBe(13);
	});

	it("should return validation error with invalid player count", () => {
		const result = createGame({
			mode: "4p",
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
			],
		});
		expect(result.success).toBe(false);
	});

	it("should enforce strict follow-suit validation", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
				{ seat: 2, team: "red" },
				{ seat: 3, team: "blue" },
			],
		});
		if (!gameResult.success) return;

		const dealRes = deal(gameResult.state, { deck, seat: 0 });
		if (!dealRes.success) return;

		let state = dealRes.state;
		const turnP = getCurrentPlayer(state);
		if (!turnP) return;

		const hand = state.hands[turnP.seat] ?? [];
		const leadCard = hand[0];
		if (!leadCard) return;

		const playRes = playCard(state, { seat: turnP.seat, card: leadCard });
		if (!playRes.success) return;
		state = playRes.state;

		const nextP = getCurrentPlayer(state);
		if (!nextP) return;

		const nextHand = state.hands[nextP.seat] ?? [];
		const leadSuit = state.trick.leadSuit;
		if (!leadSuit) return;

		const matchingCard = nextHand.find((c) => parseCard(c).suit === leadSuit);
		const nonMatchingCard = nextHand.find((c) => parseCard(c).suit !== leadSuit);

		if (matchingCard && nonMatchingCard) {
			const illegalRes = playCard(state, {
				seat: nextP.seat,
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
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
				{ seat: 2, team: "red" },
				{ seat: 3, team: "blue" },
			],
		});
		if (!gameResult.success) return;

		const dealRes = deal(gameResult.state, { deck, seat: 0 });
		if (!dealRes.success) return;

		expect(dealRes.state.game.turup).toBeNull();
	});

	it("should start in DEAL phase and allow dealer to deal", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
				{ seat: 2, team: "red" },
				{ seat: 3, team: "blue" },
			],
		});
		if (!gameResult.success) return;

		expect(gameResult.state.game.phase).toBe("DEAL");

		const nonDealerDeal = deal(gameResult.state, { deck, seat: 1 });
		expect(nonDealerDeal.success).toBe(false);

		const dealRes = deal(gameResult.state, { deck, seat: 0 });
		expect(dealRes.success).toBe(true);
		if (dealRes.success) {
			expect(dealRes.state.game.phase).not.toBe("DEAL");
		}
	});
});
