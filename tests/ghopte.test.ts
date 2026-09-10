import { describe, expect, it } from "vitest";
import { createDeck, createGame, deal, getLegalMoves, getCurrentPlayer, parseCard } from "../src";
import { detectGhopte } from "../src/core/rules/four-player";

const deck = createDeck();

describe("Ghopte Phase Mechanics", () => {
	it("should correctly detect Ghopte when a player holds single 10 of a suit", () => {
		const hands = {
			0: ["10s", "Ah", "Kd"] as const,
			1: ["2s", "3s"] as const,
			2: [] as const,
			3: [] as const,
		};

		const ghoptes = detectGhopte({ hands, dealerSeat: 3 });
		expect(ghoptes).not.toBeNull();
		const activeGhopte = ghoptes?.[0];
		expect(activeGhopte?.seat).toBe(0);
		expect(activeGhopte && parseCard(activeGhopte.card).suit).toBe("spades");
		expect(activeGhopte?.card).toBe("10s");
	});

	it("should allow guessing players to play any hand card during Ghopte round", () => {
		const gameResult = createGame({
			mode: "4p",
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "02" },
				{ seat: 1, team: "13" },
				{ seat: 2, team: "02" },
				{ seat: 3, team: "13" },
			],
		});
		if (!gameResult.success) return;

		const dealRes = deal(gameResult.state, { deck, seat: 0 });
		if (!dealRes.success) return;

		if (dealRes.state.game.phase === "GHOPTE") {
			const turnP = getCurrentPlayer(dealRes.state);
			if (turnP) {
				const moves = getLegalMoves(dealRes.state, turnP.seat);
				const hand = dealRes.state.hands[turnP.seat] ?? [];
				// All hand cards are legal for guessing player
				expect(moves.length).toBe(hand.length);
			}
		}
	});
});
