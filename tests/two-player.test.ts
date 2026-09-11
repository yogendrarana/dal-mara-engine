import { describe, expect, it } from "vitest";
import {
	createDeck,
	createGame,
	dealTwoPlayerHands,
	dealTwoPlayerStacks,
	declareTurup,
	getCurrentPlayer,
	getLegalMoves,
	getRemainingCards2P,
	playCard,
} from "../src";

const deck = createDeck();

describe("2-Player Game Mode", () => {
	it("should initialize 2-player hand deal, turup declaration, stack deal, and trick play", () => {
		const gameResult = createGame({
			mode: "2p",
			dealerSeat: 0,
			players: [{ seat: 0 }, { seat: 1 }],
		});
		if (!gameResult.success) throw new Error("Create failed");

		// Initial state: pre-deal, dealer's turn
		expect(getCurrentPlayer(gameResult.state)?.seat).toBe(0);

		// 1. Dealer deals hand cards
		const handRes = dealTwoPlayerHands(gameResult.state, { deck, seat: 0 });
		expect(handRes.success).toBe(true);
		if (!handRes.success) return;

		// 6 cards each in hand
		expect(handRes.state.hands[0]?.length).toBe(6);
		expect(handRes.state.hands[1]?.length).toBe(6);

		// Stacks must be empty before stack deal
		const p1StacksPre = handRes.state.stacks[0] ?? [];
		const p2StacksPre = handRes.state.stacks[1] ?? [];
		expect(p1StacksPre.every((s) => !s.faceUpCard && s.hiddenCards.length === 0)).toBe(true);
		expect(p2StacksPre.every((s) => !s.faceUpCard && s.hiddenCards.length === 0)).toBe(true);

		// Turup not declared yet
		expect(handRes.state.game.turup).toBeNull();

		// Utility: check remaining 40 cards
		const remaining40 = getRemainingCards2P(handRes.state, deck);
		expect(remaining40.length).toBe(40);

		// Turn passes to non-dealer (seat 1) to declare Turup
		const declP = getCurrentPlayer(handRes.state);
		expect(declP?.seat).toBe(1);

		// Trying to deal stacks before Turup declaration should fail
		const prematureStackDeal = dealTwoPlayerStacks(handRes.state, { deck: remaining40, seat: 0 });
		expect(prematureStackDeal.success).toBe(false);

		// Trying to play card before Turup declaration should fail
		const prematurePlay = playCard(handRes.state, { seat: 1, card: handRes.state.hands[1]![0]! });
		expect(prematurePlay.success).toBe(false);

		// 2. Non-dealer declares Turup
		const turupRes = declareTurup(handRes.state, { seat: 1, suit: "spades" });
		expect(turupRes.success).toBe(true);
		if (!turupRes.success) return;

		expect(turupRes.state.game.turup).toBe("spades");

		// Turn passes to dealer (seat 0) to deal stacks
		const stackDealer = getCurrentPlayer(turupRes.state);
		expect(stackDealer?.seat).toBe(0);

		// Trying to play card before stacks are dealt should fail
		const playBeforeStacks = playCard(turupRes.state, { seat: 1, card: turupRes.state.hands[1]![0]! });
		expect(playBeforeStacks.success).toBe(false);
		expect(getLegalMoves(turupRes.state, 1)).toEqual([]);

		// 3. Dealer deals the stacks
		const stackRes = dealTwoPlayerStacks(turupRes.state, { deck: remaining40, seat: 0 });
		expect(stackRes.success).toBe(true);
		if (!stackRes.success) return;

		const p1Stacks = stackRes.state.stacks[0];
		const p2Stacks = stackRes.state.stacks[1];
		expect(p1Stacks?.length).toBe(4);
		expect(p2Stacks?.length).toBe(4);
		expect(p1Stacks?.[0]?.position).toBe(0);
		expect(p1Stacks?.[0]?.hiddenCards.length).toBe(4);
		expect(p1Stacks?.[0]?.faceUpCard).not.toBeNull();

		// Turn passes to non-dealer (seat 1) to lead trick 1
		const leadP = getCurrentPlayer(stackRes.state);
		expect(leadP?.seat).toBe(1);

		// Legal moves are now available
		const moves = getLegalMoves(stackRes.state, 1);
		expect(moves.length).toBeGreaterThan(0);
	});
});
