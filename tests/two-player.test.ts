import { describe, expect, it } from "vitest";
import { createDeck, createGame, deal, declareTurup, getCurrentPlayer } from "../src";

const deck = createDeck();

describe("2-Player Game Mode", () => {
	it("should initialize 2-player deal, turup declaration, and stack setup", () => {
		const gameResult = createGame({
			mode: "2p",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "p1" },
				{ id: "p2", name: "Bob", position: 1, team: "p2" },
			],
		});
		if (!gameResult.success) throw new Error("Create failed");

		const dealRes = deal(gameResult.state, { deck, playerPosition: 0 });
		expect(dealRes.success).toBe(true);
		if (!dealRes.success) return;

		expect(dealRes.state.game.phase).toBe("TURUP_DECLARATION");

		const declP = getCurrentPlayer(dealRes.state);
		expect(declP?.id).toBe("p2");

		if (declP) {
			const declRes = declareTurup(dealRes.state, { playerPosition: declP.position, suit: "spades" });
			expect(declRes.success).toBe(true);
			if (!declRes.success) return;

			expect(declRes.state.game.phase).toBe("PLAYING");
			expect(declRes.state.game.turup).toBe("spades");

			const p1Stacks = declRes.state.stacks.p1;
			const p2Stacks = declRes.state.stacks.p2;
			expect(p1Stacks?.length).toBe(4);
			expect(p2Stacks?.length).toBe(4);
			expect(p1Stacks?.[0]?.position).toBe(0);
		}
	});
});
