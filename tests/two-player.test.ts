import { describe, expect, it } from "vitest";
import { createDeck, Game } from "../src";

const deck = createDeck();

describe("2-Player Game Mode", () => {
	it("should initialize 2-player deal, turup declaration, and stack setup", () => {
		const game = Game.create({
			id: "game-2p",
			mode: "2P",
			dealerId: "p1",
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "p1" },
				{ id: "p2", name: "Bob", position: 1, team: "p2" },
			],
		}) as Game;

		const dealRes = game.deal({ deck, playerId: "p1" });
		expect(dealRes.success).toBe(true);
		expect(game.phase).toBe("TURUP_DECLARATION");

		const declP = game.currentPlayer;
		expect(declP?.id).toBe("p2");

		if (declP) {
			const declRes = game.declareTurup({ playerId: declP.id, suit: "spades" });
			expect(declRes.success).toBe(true);
			expect(game.phase).toBe("PLAYING");
			expect(game.currentTurup).toBe("spades");

			const p1Stacks = game.state.stacks2P.p1;
			const p2Stacks = game.state.stacks2P.p2;
			expect(p1Stacks?.length).toBe(4);
			expect(p2Stacks?.length).toBe(4);
			expect(p1Stacks?.[0]?.id).toBe("stack-0");
			expect(p1Stacks?.[0]?.position).toBe(0);
		}
	});
});
