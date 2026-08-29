import { describe, expect, it } from "vitest";
import { createDeck, Game } from "../src";

const deck = createDeck();

describe("Stress & Determinism Testing", () => {
	it("should simulate 1,000 complete 4-Player games without errors", () => {
		const gameCount = 1000;
		let completedCount = 0;

		for (let seed = 1; seed <= gameCount; seed++) {
			const game = Game.create({
				id: `stress-4p-${seed}`,
				mode: "4P",
				seed,
				dealerId: "p1",
				players: [
					{ id: "p1", name: "Alice", position: 0, team: "red" },
					{ id: "p2", name: "Bob", position: 1, team: "blue" },
					{ id: "p3", name: "Charlie", position: 2, team: "red" },
					{ id: "p4", name: "Dave", position: 3, team: "blue" },
				],
			}) as Game;

			const startRes = game.start(deck);
			expect(startRes.success).toBe(true);

			let maxSafetyMoves = 200;
			while (!game.isFinished && maxSafetyMoves > 0) {
				maxSafetyMoves--;

				const turnP = game.currentPlayer;
				if (!turnP) break;

				const legalMoves = game.getLegalMoves(turnP.id);
				expect(legalMoves.length).toBeGreaterThan(0);

				const move = legalMoves[0];
				if (!move) break;

				const playRes = game.playCard({
					playerId: turnP.id,
					cardId: move.card.id,
					stackPosition: move.stackPosition,
				});
				expect(playRes.success).toBe(true);
			}

			expect(game.isFinished).toBe(true);
			expect(game.winnerTeam).not.toBeNull();
			completedCount++;
		}

		expect(completedCount).toBe(gameCount);
	});

	it("should simulate 1,000 complete 2-Player games without errors", () => {
		const gameCount = 1000;
		let completedCount = 0;

		for (let seed = 1; seed <= gameCount; seed++) {
			const game = Game.create({
				id: `stress-2p-${seed}`,
				mode: "2P",
				seed,
				dealerId: "p1",
				players: [
					{ id: "p1", name: "Alice", position: 0, team: "p1" },
					{ id: "p2", name: "Bob", position: 1, team: "p2" },
				],
			}) as Game;

			const startRes = game.start(deck);
			expect(startRes.success).toBe(true);

			const declP = game.currentPlayer;
			if (!declP) break;

			const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
			const suitToDeclare = suits[seed % 4] ?? "spades";
			game.declareTurup({ playerId: declP.id, suit: suitToDeclare });

			let maxSafetyMoves = 300;
			while (!game.isFinished && maxSafetyMoves > 0) {
				maxSafetyMoves--;

				const turnP = game.currentPlayer;
				if (!turnP) break;

				const legalMoves = game.getLegalMoves(turnP.id);
				expect(legalMoves.length).toBeGreaterThan(0);

				const move = legalMoves[0];
				if (!move) break;

				const playRes = game.playCard({
					playerId: turnP.id,
					cardId: move.card.id,
					stackPosition: move.stackPosition,
				});
				expect(playRes.success).toBe(true);
			}

			expect(game.isFinished).toBe(true);
			completedCount++;
		}

		expect(completedCount).toBe(gameCount);
	});
});
