import { createDeck, createGame, dealFourPlayer, playCard, getCurrentPlayer, parseCard } from "../src";
import type { Card, GameState } from "../src";
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

		const dealRes = dealFourPlayer(gameResult.state, { deck, seat: 0 });
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

		const dealRes = dealFourPlayer(gameResult.state, { deck, seat: 0 });
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

		const dealRes = dealFourPlayer(gameResult.state, { deck, seat: 0 });
		if (!dealRes.success) return;

		expect(dealRes.state.game.turup).toBeNull();
	});

	it("should start with empty hands and allow dealer to deal", () => {
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

		expect(Object.values(gameResult.state.hands).length).toBe(0);

		const nonDealerDeal = dealFourPlayer(gameResult.state, { deck, seat: 1 });
		expect(nonDealerDeal.success).toBe(false);

		const dealRes = dealFourPlayer(gameResult.state, { deck, seat: 0 });
		expect(dealRes.success).toBe(true);
		if (dealRes.success) {
			expect(dealRes.state.hands[0]?.length).toBe(13);
		}
	});

	it("should permanently lock Turup once its originating trick completes and prevent override in subsequent tricks", () => {
		// 1. Deal a 4P game (dealer is seat 3 so seat 0 leads Trick 1)
		const gameResult = createGame({
			mode: "4p",
			dealerSeat: 3,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
				{ seat: 2, team: "red" },
				{ seat: 3, team: "blue" },
			],
		});
		expect(gameResult.success).toBe(true);
		if (!gameResult.success) return;

		const dealRes = dealFourPlayer(gameResult.state, { deck, seat: 3 });
		expect(dealRes.success).toBe(true);
		if (!dealRes.success) return;

		// Configure hands for deterministic trick play:
		// Seat 0: Kd (Diamond), 2c (Club - void in Hearts & Spades)
		// Seat 1: Qd (Diamond), 3c (Club)
		// Seat 2: 2s (Spade - void in Diamonds!), Ah (Heart)
		// Seat 3: Jd (Diamond), 10s (Spade - void in Hearts!)
		let state: GameState = {
			...dealRes.state,
			ghoptes: [],
			hands: {
				0: ["Kd", "2c"] as Card[],
				1: ["Qd", "3c"] as Card[],
				2: ["2s", "Ah"] as Card[],
				3: ["Jd", "10s"] as Card[],
			},
		};

		// 2. Trick 1:
		// Seat 0 leads Diamonds
		const p1 = playCard(state, { seat: 0, card: "Kd" });
		expect(p1.success).toBe(true);
		if (!p1.success) return;
		state = p1.state;

		// Seat 1 plays Diamonds
		const p2 = playCard(state, { seat: 1, card: "Qd" });
		expect(p2.success).toBe(true);
		if (!p2.success) return;
		state = p2.state;

		// Seat 2 has no Diamonds, plays Spades (makesTurup: true, Turup is now Spades)
		const p3 = playCard(state, { seat: 2, card: "2s" });
		expect(p3.success).toBe(true);
		if (!p3.success) return;
		expect(p3.state.moveDetail.makesTurup).toBe(true);
		expect(p3.state.game.turup).toBe("spades");
		state = p3.state;

		// Seat 3 plays Diamonds
		const p4 = playCard(state, { seat: 3, card: "Jd" });
		expect(p4.success).toBe(true);
		if (!p4.success) return;
		state = p4.state;

		// Trick 1 completes. Verify state.game.turup === "spades" and Seat 2 won with trump
		expect(state.game.turup).toBe("spades");
		expect(state.nextMoveSeat).toBe(2);

		// 3. Trick 2:
		// Winner of Trick 1 (Seat 2) leads Hearts
		const p5 = playCard(state, { seat: 2, card: "Ah" });
		expect(p5.success).toBe(true);
		if (!p5.success) return;
		state = p5.state;
		expect(state.nextMoveSeat).toBe(3);

		// Next player (Seat 3) plays Spades (trump)
		const p6 = playCard(state, { seat: 3, card: "10s" });
		expect(p6.success).toBe(true);
		if (!p6.success) return;
		expect(p6.state.moveDetail.makesTurup).toBe(false);
		expect(p6.state.game.turup).toBe("spades");
		state = p6.state;
		expect(state.nextMoveSeat).toBe(0);

		// Next player (Seat 0, void in Hearts and Spades) plays Clubs
		const p7 = playCard(state, { seat: 0, card: "2c" });
		expect(p7.success).toBe(true);
		if (!p7.success) return;

		// 4. Assert:
		// makesTurup MUST be false, Turup MUST remain "spades"
		expect(p7.state.moveDetail.makesTurup).toBe(false);
		expect(p7.state.game.turup).toBe("spades");
		state = p7.state;
		expect(state.nextMoveSeat).toBe(1);

		// Seat 1 plays Clubs to complete Trick 2
		const p8 = playCard(state, { seat: 1, card: "3c" });
		expect(p8.success).toBe(true);
		if (!p8.success) return;
		state = p8.state;

		// Winner of Trick 2 MUST be determined with "spades" as Turup (Seat 3), NOT "clubs" (Seat 0 or 1)
		expect(state.game.turup).toBe("spades");
		expect(state.nextMoveSeat).toBe(3);
	});

	it("should override Turup when a subsequent player in the same trick has no lead suit and no Turup in hand", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerSeat: 3,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
				{ seat: 2, team: "red" },
				{ seat: 3, team: "blue" },
			],
		});
		expect(gameResult.success).toBe(true);
		if (!gameResult.success) return;

		const dealRes = dealFourPlayer(gameResult.state, { deck, seat: 3 });
		expect(dealRes.success).toBe(true);
		if (!dealRes.success) return;

		// Seat 0: Kd (Diamond)
		// Seat 1: 2s (Spades - void in Diamonds)
		// Seat 2: Ah (Heart - void in Diamonds AND Spades)
		// Seat 3: Qd (Diamond)
		let state: GameState = {
			...dealRes.state,
			ghoptes: [],
			hands: {
				0: ["Kd"] as Card[],
				1: ["2s"] as Card[],
				2: ["Ah"] as Card[],
				3: ["Qd"] as Card[],
			},
		};

		// Seat 0 leads Diamonds
		const p1 = playCard(state, { seat: 0, card: "Kd" });
		expect(p1.success).toBe(true);
		if (!p1.success) return;
		state = p1.state;

		// Seat 1 plays Spades -> establishes brand new Turup
		const p2 = playCard(state, { seat: 1, card: "2s" });
		expect(p2.success).toBe(true);
		if (!p2.success) return;
		expect(p2.state.moveDetail.makesTurup).toBe(true);
		expect(p2.state.game.turup).toBe("spades");
		state = p2.state;

		// Seat 2 has no Diamonds and no Spades in hand, plays Hearts -> overrides Turup to Hearts
		const p3 = playCard(state, { seat: 2, card: "Ah" });
		expect(p3.success).toBe(true);
		if (!p3.success) return;
		expect(p3.state.moveDetail.makesTurup).toBe(true);
		expect(p3.state.game.turup).toBe("hearts");
		state = p3.state;

		// Seat 3 plays Diamonds to complete Trick 1
		const p4 = playCard(state, { seat: 3, card: "Qd" });
		expect(p4.success).toBe(true);
		if (!p4.success) return;
		state = p4.state;

		// Final Turup for Trick 1 must be "hearts", and Seat 2 (Ah) wins the trick
		expect(state.game.turup).toBe("hearts");
		expect(state.nextMoveSeat).toBe(2);
	});

	it("should preserve Turup when a player has no lead suit but holds Turup cards in hand and plays another off-suit", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerSeat: 3,
			players: [
				{ seat: 0, team: "red" },
				{ seat: 1, team: "blue" },
				{ seat: 2, team: "red" },
				{ seat: 3, team: "blue" },
			],
		});
		expect(gameResult.success).toBe(true);
		if (!gameResult.success) return;

		const dealRes = dealFourPlayer(gameResult.state, { deck, seat: 3 });
		expect(dealRes.success).toBe(true);
		if (!dealRes.success) return;

		// Seat 0: Kd (Diamond)
		// Seat 1: 2s (Spades - void in Diamonds)
		// Seat 2: Ah (Heart), 10s (Spades) -> void in Diamonds, but HOLDS Spades!
		// Seat 3: Qd (Diamond)
		let state: GameState = {
			...dealRes.state,
			ghoptes: [],
			hands: {
				0: ["Kd"] as Card[],
				1: ["2s"] as Card[],
				2: ["Ah", "10s"] as Card[],
				3: ["Qd"] as Card[],
			},
		};

		// Seat 0 leads Diamonds
		const p1 = playCard(state, { seat: 0, card: "Kd" });
		expect(p1.success).toBe(true);
		if (!p1.success) return;
		state = p1.state;

		// Seat 1 plays Spades -> establishes brand new Turup
		const p2 = playCard(state, { seat: 1, card: "2s" });
		expect(p2.success).toBe(true);
		if (!p2.success) return;
		expect(p2.state.moveDetail.makesTurup).toBe(true);
		expect(p2.state.game.turup).toBe("spades");
		state = p2.state;

		// Seat 2 plays Ah to preserve 10s in hand -> Turup MUST NOT be overridden!
		const p3 = playCard(state, { seat: 2, card: "Ah" });
		expect(p3.success).toBe(true);
		if (!p3.success) return;
		expect(p3.state.moveDetail.makesTurup).toBe(false);
		expect(p3.state.game.turup).toBe("spades");
		state = p3.state;

		// Seat 3 plays Diamonds to complete Trick 1
		const p4 = playCard(state, { seat: 3, card: "Qd" });
		expect(p4.success).toBe(true);
		if (!p4.success) return;
		state = p4.state;

		// Final Turup must still be "spades", and Seat 1 (2s) wins the trick
		expect(state.game.turup).toBe("spades");
		expect(state.nextMoveSeat).toBe(1);
	});
});
