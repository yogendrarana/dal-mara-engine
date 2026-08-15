import { describe, expect, it } from "vitest";
import { Engine } from "../src/engine";
import { detectGhopte } from "../src/rules/four-player";

describe("Ghopte Phase Mechanics", () => {
	it("should correctly detect Ghopte when a player holds single 10 of a suit", () => {
		const hands = {
			p1: [
				{ id: "10s" as const, suit: "spades" as const, rank: "10" as const },
				{ id: "Ah" as const, suit: "hearts" as const, rank: "A" as const },
				{ id: "Kd" as const, suit: "diamonds" as const, rank: "K" as const },
			],
			p2: [
				{ id: "2s" as const, suit: "spades" as const, rank: "2" as const },
				{ id: "3s" as const, suit: "spades" as const, rank: "3" as const },
			],
		};

		const ghopteState = detectGhopte(hands);
		expect(ghopteState).not.toBeNull();
		const activeGhopte = ghopteState?.ghoptes[ghopteState.activeIndex];
		expect(activeGhopte?.declarerId).toBe("p1");
		expect(activeGhopte?.suit).toBe("spades");
		expect(activeGhopte?.tenCard.id).toBe("10s");
	});

	it("should allow guessing players to play any hand card during Ghopte round", () => {
		const game = Engine.createGame({
			id: "ghopte-game",
			mode: "4P",
			seed: 12345,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});

		game.start();

		if (game.phase === "GHOPTE") {
			const turnP = game.currentPlayer;
			if (turnP) {
				const moves = game.getLegalMoves(turnP.id);
				const hand = game.state.hands[turnP.id] ?? [];
				// All hand cards are legal for guessing player
				expect(moves.length).toBe(hand.length);
			}
		}
	});
});
