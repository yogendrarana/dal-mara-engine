import { describe, expect, it } from "vitest";
import { Engine } from "../src/engine";

describe("Dal Mara Notation (DMN) - FEN Equivalent", () => {
	it("should export a game state to DMN string without forced prefix", () => {
		const game = Engine.createGame({
			id: "dmn-1",
			mode: "4P",
			seed: 1234,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});
		game.start();

		const dmnStr = game.toDMN();
		expect(dmnStr.startsWith("v1/4P/")).toBe(true);
		expect(dmnStr.includes("D:0")).toBe(true);
	});

	it("should perform roundtrip DMN export and import snapshot restoration", () => {
		const game = Engine.createGame({
			id: "dmn-2",
			mode: "4P",
			seed: 555,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});
		game.start();

		const turnP = game.currentPlayer;
		if (turnP) {
			const hand = game.state.hands[turnP.id] ?? [];
			const firstCard = hand[0];
			if (firstCard) {
				game.playCard({ playerId: turnP.id, cardId: firstCard.id });
			}
		}

		const dmnStr1 = game.toDMN();
		const restoredGame = Engine.fromDMN(dmnStr1);
		const dmnStr2 = restoredGame.toDMN();

		expect(dmnStr1).toBe(dmnStr2);
		expect(restoredGame.mode).toBe(game.mode);
		expect(restoredGame.phase).toBe(game.phase);
		expect(restoredGame.state.currentTurnPlayerId).toBe(
			game.state.currentTurnPlayerId,
		);

		// Also support parsing legacy DMN: prefix
		const legacyRestored = Engine.fromDMN(`DMN:${dmnStr1}`);
		expect(legacyRestored.toDMN()).toBe(dmnStr1);
	});

	it("should export and import 2-Player game DMN state including hidden stacks", () => {
		const game = Engine.createGame({
			id: "dmn-3",
			mode: "2P",
			seed: 888,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
			],
		});
		game.start();

		const currP = game.currentPlayer;
		if (currP) {
			game.declareTurup({ playerId: currP.id, suit: "hearts" });
		}

		const dmnStr1 = game.toDMN();
		expect(dmnStr1.startsWith("v1/2P/")).toBe(true);
		expect(dmnStr1.includes("TR:h")).toBe(true);

		const restoredGame = Engine.fromDMN(dmnStr1);
		expect(restoredGame.currentTurup).toBe("hearts");
		expect(restoredGame.toDMN()).toBe(dmnStr1);
	});
});
