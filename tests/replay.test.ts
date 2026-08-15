import { describe, expect, it } from "vitest";
import { Engine } from "../src/engine";

describe("Serialization & Replay Engine", () => {
	it("should serialize and deserialize game state accurately", () => {
		const game = Engine.createGame({
			id: "replay-1",
			mode: "4P",
			seed: 10101,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});
		game.start();

		const json = game.serialize();
		const deserializedGame = Engine.deserialize(json);

		expect(deserializedGame.id).toBe(game.id);
		expect(deserializedGame.mode).toBe(game.mode);
		expect(deserializedGame.phase).toBe(game.phase);
		expect(deserializedGame.serialize()).toBe(json);
	});

	it("should export replay and replay actions step-by-step identically", () => {
		const game = Engine.createGame({
			id: "replay-2",
			mode: "4P",
			seed: 20202,
			players: [
				{ id: "p1", name: "Alice" },
				{ id: "p2", name: "Bob" },
				{ id: "p3", name: "Charlie" },
				{ id: "p4", name: "Dave" },
			],
		});
		game.start();

		for (let i = 0; i < 4; i++) {
			if (game.isFinished) break;
			const turnP = game.currentPlayer;
			if (!turnP) break;
			const legalMoves = game.getLegalMoves(turnP.id);
			const move = legalMoves[0];
			if (move) {
				game.playCard({ playerId: turnP.id, cardId: move.card.id });
			}
		}

		const replayData = game.exportReplay();
		const replayedGame = Engine.playReplay(replayData);

		expect(replayedGame.state.hands).toEqual(game.state.hands);
		expect(replayedGame.state.currentTrick).toEqual(game.state.currentTrick);
		expect(replayedGame.toDMN()).toBe(game.toDMN());
	});
});
