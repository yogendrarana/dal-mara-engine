import { describe, expect, it } from "vitest";
import {
	createDeck,
	shuffleDeck,
	createGame,
	deal,
	declareTurup,
	playCard,
	getCurrentPlayer,
	getLegalMoves,
	isFinished,
} from "../src";

const deck = createDeck();

describe("Stress & Determinism Testing", () => {
	it("should simulate 1,000 complete 4-Player games without errors", () => {
		const gameCount = 1000;
		let completedCount = 0;

		for (let i = 1; i <= gameCount; i++) {
			const gameResult = createGame({
				mode: "4p",
				dealerPosition: 0,
				players: [
					{ position: 0, team: "red" },
					{ position: 1, team: "blue" },
					{ position: 2, team: "red" },
					{ position: 3, team: "blue" },
				],
			});
			if (!gameResult.success) throw new Error("Create failed");

			const shuffledDeck = shuffleDeck(deck);
			const dealRes = deal(gameResult.state, { deck: shuffledDeck, playerPosition: 0 });
			expect(dealRes.success).toBe(true);
			if (!dealRes.success) throw new Error("Deal failed");

			let state = dealRes.state;
			let maxSafetyMoves = 200;

			while (!isFinished(state) && maxSafetyMoves > 0) {
				maxSafetyMoves--;

				const turnP = getCurrentPlayer(state);
				if (!turnP) break;

				const legalMoves = getLegalMoves(state, turnP.position);
				expect(legalMoves.length).toBeGreaterThan(0);

				const move = legalMoves[0];
				if (!move) break;

				const playRes = playCard(state, {
					playerPosition: turnP.position,
					card: move.card,
				});
				expect(playRes.success).toBe(true);
				if (!playRes.success) break;

				state = playRes.state;
			}

			expect(isFinished(state)).toBe(true);
			completedCount++;
		}

		expect(completedCount).toBe(gameCount);
	});

	it("should simulate 1,000 complete 2-Player games without errors", () => {
		const gameCount = 1000;
		let completedCount = 0;

		for (let i = 1; i <= gameCount; i++) {
			const gameResult = createGame({
				mode: "2p",
				dealerPosition: 0,
				players: [
					{ position: 0, team: "p1" },
					{ position: 1, team: "p2" },
				],
			});
			if (!gameResult.success) throw new Error("Create failed");

			const shuffledDeck = shuffleDeck(deck);
			const dealRes = deal(gameResult.state, { deck: shuffledDeck, playerPosition: 0 });
			expect(dealRes.success).toBe(true);
			if (!dealRes.success) throw new Error("Deal failed");

			let state = dealRes.state;

			const declP = getCurrentPlayer(state);
			if (!declP) throw new Error("No declarator");

			const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
			const suitToDeclare = suits[i % 4] ?? "spades";
			const declRes = declareTurup(state, { playerPosition: declP.position, suit: suitToDeclare });
			expect(declRes.success).toBe(true);
			if (!declRes.success) throw new Error("Declare turup failed");

			state = declRes.state;

			let maxSafetyMoves = 300;
			while (!isFinished(state) && maxSafetyMoves > 0) {
				maxSafetyMoves--;

				const turnP = getCurrentPlayer(state);
				if (!turnP) break;

				const legalMoves = getLegalMoves(state, turnP.position);
				expect(legalMoves.length).toBeGreaterThan(0);

				const move = legalMoves[0];
				if (!move) break;

				const playRes = playCard(state, {
					playerPosition: turnP.position,
					card: move.card,
				});
				expect(playRes.success).toBe(true);
				if (!playRes.success) break;

				state = playRes.state;
			}

			expect(isFinished(state)).toBe(true);
			completedCount++;
		}

		expect(completedCount).toBe(gameCount);
	});
});
