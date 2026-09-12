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
	isFinished,
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

	it("should allow playing the 26th (final) trick when all stacks are empty and each player has 1 card in hand", () => {
		const gameResult = createGame({
			mode: "2p",
			dealerSeat: 0,
			players: [{ seat: 0 }, { seat: 1 }],
		});
		if (!gameResult.success) throw new Error("Create failed");

		const handRes = dealTwoPlayerHands(gameResult.state, { deck, seat: 0 });
		if (!handRes.success) throw new Error("Hand deal failed");

		const turupRes = declareTurup(handRes.state, { seat: 1, suit: "spades" });
		if (!turupRes.success) throw new Error("Turup failed");

		const remaining40 = getRemainingCards2P(turupRes.state, deck);
		const stackRes = dealTwoPlayerStacks(turupRes.state, { deck: remaining40, seat: 0 });
		if (!stackRes.success) throw new Error("Stack deal failed");

		// Play 25 tricks, prioritizing playing from stacks so stacks are fully depleted
		let state = stackRes.state;
		let tricksCompleted = 0;

		while (tricksCompleted < 25) {
			const turnP = getCurrentPlayer(state);
			if (!turnP) throw new Error(`No turn player at trick ${tricksCompleted + 1}`);

			const legalMoves = getLegalMoves(state, turnP.seat);
			expect(legalMoves.length).toBeGreaterThan(0);

			// Prioritize playing cards from stacks first to ensure stacks are completely empty by trick 26
			const stackMove = legalMoves.find((m) => m.stackPosition !== undefined);
			const moveToPlay = stackMove ?? legalMoves[0]!;

			const playRes = playCard(state, {
				seat: turnP.seat,
				card: moveToPlay.card,
			});
			expect(playRes.success).toBe(true);
			if (!playRes.success) throw new Error(`Play failed: ${playRes.error.message}`);

			state = playRes.state;
			if (state.trick.playNumber === 0) {
				tricksCompleted++;
			}
		}

		expect(tricksCompleted).toBe(25);
		expect(state.trick.number).toBe(26);

		// Verify stacks are completely empty
		const allStacksEmpty = Object.values(state.stacks).every((pStacks) =>
			pStacks.every((s) => !s.faceUpCard && s.hiddenCards.length === 0),
		);
		expect(allStacksEmpty).toBe(true);

		// Both players have exactly 1 card remaining in hand
		expect(state.hands[0]?.length).toBe(1);
		expect(state.hands[1]?.length).toBe(1);

		// Verify game is not yet finished
		expect(isFinished(state)).toBe(false);

		// Verify dealing stacks or declaring turup now is rejected
		const invalidStackDeal = dealTwoPlayerStacks(state, { deck: remaining40, seat: 0 });
		expect(invalidStackDeal.success).toBe(false);

		const invalidTurupDecl = declareTurup(state, { seat: 1, suit: "hearts" });
		expect(invalidTurupDecl.success).toBe(false);

		// Trick 26 Lead: current player must have legal moves and be able to play
		const leadP = getCurrentPlayer(state);
		expect(leadP).not.toBeNull();
		const leadLegalMoves = getLegalMoves(state, leadP!.seat);
		expect(leadLegalMoves.length).toBe(1);
		expect(leadLegalMoves[0]?.card).toBe(state.hands[leadP!.seat]![0]);

		const leadPlayRes = playCard(state, {
			seat: leadP!.seat,
			card: leadLegalMoves[0]!.card,
		});
		expect(leadPlayRes.success).toBe(true);
		if (!leadPlayRes.success) throw new Error("Lead play at trick 26 failed");

		state = leadPlayRes.state;

		// Trick 26 Follow: opponent must have legal moves and be able to play
		const followP = getCurrentPlayer(state);
		expect(followP).not.toBeNull();
		const followLegalMoves = getLegalMoves(state, followP!.seat);
		expect(followLegalMoves.length).toBe(1);
		expect(followLegalMoves[0]?.card).toBe(state.hands[followP!.seat]![0]);

		const followPlayRes = playCard(state, {
			seat: followP!.seat,
			card: followLegalMoves[0]!.card,
		});
		expect(followPlayRes.success).toBe(true);
		if (!followPlayRes.success) throw new Error("Follow play at trick 26 failed");

		state = followPlayRes.state;

		// Game is now finished (all 26 tricks completed, all hands and stacks empty)
		expect(isFinished(state)).toBe(true);
		expect(state.hands[0]?.length).toBe(0);
		expect(state.hands[1]?.length).toBe(0);

		// Playing card after finish must be rejected
		const afterFinishPlay = playCard(state, { seat: 0, card: deck[0]! });
		expect(afterFinishPlay.success).toBe(false);
	});
});
