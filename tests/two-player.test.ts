import { describe, expect, it } from "vitest";
import { createDeck, createGame, deal, declareTurup, getCurrentPlayer } from "../src";

const deck = createDeck();

describe("2-Player Game Mode", () => {
	it("should initialize 2-player deal, turup declaration, and stack setup", () => {
		const gameResult = createGame({
			mode: "2p",
			dealerSeat: 0,
			players: [{ seat: 0 }, { seat: 1 }],
		});
		if (!gameResult.success) throw new Error("Create failed");

		const dealRes = deal(gameResult.state, { deck, seat: 0 });
		expect(dealRes.success).toBe(true);
		if (!dealRes.success) return;

		expect(dealRes.state.game.turup).toBeNull();

		const declP = getCurrentPlayer(dealRes.state);
		expect(declP?.seat).toBe(1);

		if (declP) {
			const declRes = declareTurup(dealRes.state, { seat: declP.seat, suit: "spades" });
			expect(declRes.success).toBe(true);
			if (!declRes.success) return;

			expect(declRes.state.game.turup).toBe("spades");

			const p1Stacks = declRes.state.stacks[0];
			const p2Stacks = declRes.state.stacks[1];
			expect(p1Stacks?.length).toBe(4);
			expect(p2Stacks?.length).toBe(4);
			expect(p1Stacks?.[0]?.position).toBe(0);
		}
	});
});
