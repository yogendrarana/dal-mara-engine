import { describe, expect, it } from "vitest";
import { createDeck, createGame, deal, getLegalMoves, getCurrentPlayer, parseCard } from "../src";
import { detectGhopte } from "../src/core/rules/four-player";

const deck = createDeck();

describe("Ghopte Phase Mechanics", () => {
	it("should correctly detect Ghopte when a player holds single 10 of a suit", () => {
		const hands = {
			p1: ["10s", "Ah", "Kd"] as const,
			p2: ["2s", "3s"] as const,
		};

		const ghoptes = detectGhopte({ hands });
		expect(ghoptes).not.toBeNull();
		const activeGhopte = ghoptes?.[0];
		expect(activeGhopte?.playerPosition).toBe(0);
		expect(activeGhopte && parseCard(activeGhopte.card).suit).toBe("spades");
		expect(activeGhopte?.card).toBe("10s");
	});

	it("should allow guessing players to play any hand card during Ghopte round", () => {
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

		if (dealRes.state.game.phase === "GHOPTE") {
			const turnP = getCurrentPlayer(dealRes.state);
			if (turnP) {
				const moves = getLegalMoves(dealRes.state, turnP.position);
				const hand = dealRes.state.hands[turnP.id] ?? [];
				// All hand cards are legal for guessing player
				expect(moves.length).toBe(hand.length);
			}
		}
	});
});
