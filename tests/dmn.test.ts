import { describe, expect, it } from "vitest";
import { createDeck, Engine, importFromDMN } from "../src";
import { Game } from "../src";

const deck = createDeck();

describe("Dal Mara Notation (DMN) - DMN1 Format", () => {
	it("should export a game state to DMN1 string format", () => {
		const game = Game.create({
			id: "dmn-1",
			mode: "4P",
			seed: 1234,
			dealerId: "p1",
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		}) as Game;
		game.start(deck);

		const dmnStr = game.toDMN();
		expect(dmnStr.startsWith("DMN1 4 ")).toBe(true);

		const tokens = dmnStr.split(" ");
		expect(tokens.length).toBe(11);
		expect(tokens[0]).toBe("DMN1");
		expect(tokens[1]).toBe("4"); // 4 players
		expect(tokens[2]).toBe("0"); // dealer position
	});

	it("should perform DMN export and import snapshot parsing", () => {
		const game = Game.create({
			id: "dmn-2",
			mode: "4P",
			seed: 555,
			dealerId: "p1",
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "red" },
				{ id: "p2", name: "Bob", position: 1, team: "blue" },
				{ id: "p3", name: "Charlie", position: 2, team: "red" },
				{ id: "p4", name: "Dave", position: 3, team: "blue" },
			],
		}) as Game;
		game.start(deck);

		const turnP = game.currentPlayer;
		if (turnP) {
			const hand = game.state.hands[turnP.id] ?? [];
			const firstCard = hand[0];
			if (firstCard) {
				game.playCard({ playerId: turnP.id, cardId: firstCard.id });
			}
		}

		const dmnStr1 = game.toDMN();
		const parsed = importFromDMN(dmnStr1);

		expect(parsed.dmn.version).toBe("DMN1");
		expect(parsed.dmn.mode).toBe("4P");
		expect(parsed.dmn.dealerPosition).toBe(0);

		const restoredGame = Engine.fromDMN(dmnStr1);
		expect(restoredGame.mode).toBe(game.mode);
	});

	it("should export and import 2-Player game DMN state", () => {
		const game = Game.create({
			id: "dmn-3",
			mode: "2P",
			seed: 888,
			dealerId: "p1",
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "p1" },
				{ id: "p2", name: "Bob", position: 1, team: "p2" },
			],
		}) as Game;
		game.start(deck);

		const currP = game.currentPlayer;
		if (currP) {
			game.declareTurup({ playerId: currP.id, suit: "hearts" });
		}

		const dmnStr1 = game.toDMN();
		expect(dmnStr1.startsWith("DMN1 2 ")).toBe(true);

		const restoredGame = Engine.fromDMN(dmnStr1);
		expect(restoredGame.mode).toBe("2P");
	});
});
