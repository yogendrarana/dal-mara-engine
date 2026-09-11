import { describe, expect, it } from "vitest";
import {
	createDeck,
	shuffleDeck,
	createGame,
	dealFourPlayer,
	dealTwoPlayerHands,
	dealTwoPlayerStacks,
	getRemainingCards2P,
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
				dealerSeat: 0,
				players: [
					{ seat: 0, team: "red" },
					{ seat: 1, team: "blue" },
					{ seat: 2, team: "red" },
					{ seat: 3, team: "blue" },
				],
			});
			if (!gameResult.success) throw new Error("Create failed");

			const shuffledDeck = shuffleDeck(deck);
			const dealRes = dealFourPlayer(gameResult.state, { deck: shuffledDeck, seat: 0 });
			expect(dealRes.success).toBe(true);
			if (!dealRes.success) throw new Error("Deal failed");

			let state = dealRes.state;
			let maxSafetyMoves = 200;

			while (!isFinished(state) && maxSafetyMoves > 0) {
				maxSafetyMoves--;

				const turnP = getCurrentPlayer(state);
				if (!turnP) break;

				const legalMoves = getLegalMoves(state, turnP.seat);
				expect(legalMoves.length).toBeGreaterThan(0);

				const move = legalMoves[0];
				if (!move) break;

				const playRes = playCard(state, {
					seat: turnP.seat,
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
				dealerSeat: 0,
				players: [
					{ seat: 0, team: "p1" },
					{ seat: 1, team: "p2" },
				],
			});
			if (!gameResult.success) throw new Error("Create failed");

			const shuffledDeck = shuffleDeck(deck);
			const handDealRes = dealTwoPlayerHands(gameResult.state, { deck: shuffledDeck, seat: 0 });
			expect(handDealRes.success).toBe(true);
			if (!handDealRes.success) throw new Error("Hand deal failed");

			let state = handDealRes.state;

			const declP = getCurrentPlayer(state);
			if (!declP) throw new Error("No declarator");

			const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
			const suitToDeclare = suits[i % 4] ?? "spades";
			const declRes = declareTurup(state, { seat: declP.seat, suit: suitToDeclare });
			expect(declRes.success).toBe(true);
			if (!declRes.success) throw new Error("Declare turup failed");

			state = declRes.state;

			const remaining40 = getRemainingCards2P(state, shuffledDeck);
			const stackDealer = getCurrentPlayer(state);
			if (!stackDealer) throw new Error("No stack dealer");

			const stackDealRes = dealTwoPlayerStacks(state, { deck: remaining40, seat: stackDealer.seat });
			expect(stackDealRes.success).toBe(true);
			if (!stackDealRes.success) throw new Error("Stack deal failed");

			state = stackDealRes.state;

			let maxSafetyMoves = 300;
			while (!isFinished(state) && maxSafetyMoves > 0) {
				maxSafetyMoves--;

				const turnP = getCurrentPlayer(state);
				if (!turnP) break;

				const legalMoves = getLegalMoves(state, turnP.seat);
				expect(legalMoves.length).toBeGreaterThan(0);

				const move = legalMoves[0];
				if (!move) break;

				const playRes = playCard(state, {
					seat: turnP.seat,
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
