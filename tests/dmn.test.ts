import { describe, expect, it } from "vitest";
import { createDeck, fromDMN, Game, importFromDMN, toDMN } from "../src";

const deck = createDeck();

const make4PGame = () =>
	Game.create({
		id: "dmn-test",
		mode: "4P",
		dealerPosition: 0,
		players: [
			{ id: "p1", name: "Alice", position: 0, team: "red" },
			{ id: "p2", name: "Bob", position: 1, team: "blue" },
			{ id: "p3", name: "Charlie", position: 2, team: "red" },
			{ id: "p4", name: "Dave", position: 3, team: "blue" },
		],
	}) as Game;

describe("Dal Mara Notation (DMN) - DMN1 Snapshot Format", () => {
	it("should export initial state with all 6 sections", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		const dmn = game.toDMN();

		// Version prefix
		expect(dmn.startsWith("DMN1 ")).toBe(true);

		// All 6 sections present
		expect(dmn).toContain("G:");
		expect(dmn).toContain("H:");
		expect(dmn).toContain("S:-");
		expect(dmn).toContain("M:");
		expect(dmn).toContain("T:");
		expect(dmn).toContain("C:");

		// H section uses owner-based P0[...],P1[...] format
		expect(dmn).toMatch(/H:P0\[.*\],P1\[.*\],P2\[.*\],P3\[.*\]/);

		// toDMN utility produces the same output
		expect(toDMN(game)).toBe(dmn);
	});

	it("should encode game info in G section", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		const dmn = game.toDMN();
		const parsed = importFromDMN(dmn);

		expect(parsed.dmn.version).toBe("DMN1");
		expect(parsed.dmn.mode).toBe("4P");
		expect(parsed.dmn.dealerPosition).toBe(0);
		// No trump declared yet
		expect(parsed.dmn.trumpSuit).toBeNull();
	});

	it("should encode all 52 cards across player hands in H section", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		const parsed = importFromDMN(game.toDMN());

		// Each player should have 13 cards
		const h = parsed.dmn.hands;
		expect(h["P0"]?.length).toBe(13);
		expect(h["P1"]?.length).toBe(13);
		expect(h["P2"]?.length).toBe(13);
		expect(h["P3"]?.length).toBe(13);

		// Total = 52
		const total = Object.values(h).reduce((sum, cards) => sum + cards.length, 0);
		expect(total).toBe(52);
	});

	it("should encode initial move info as M:0,0,0", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		const parsed = importFromDMN(game.toDMN());

		expect(parsed.dmn.moveNumber).toBe(0);
		expect(parsed.dmn.number).toBe(0);
		expect(parsed.dmn.trickPlay).toBe(0);
	});

	it("should encode empty trick cards in C section for initial state", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		const parsed = importFromDMN(game.toDMN());

		expect(parsed.dmn.playedCard).toBeNull();
		expect(parsed.dmn.playedBy).toBeNull();
		expect(parsed.dmn.trickCards).toEqual([]);
	});

	it("should update DMN after playing a card", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		const turnP = game.currentPlayer;
		expect(turnP).not.toBeNull();

		const hand = game.state.hands[turnP!.id] ?? [];
		const firstCard = hand[0]!;
		game.playCard({ playerPosition: turnP!.position, card: firstCard });

		const parsed = importFromDMN(game.toDMN());

		// M section: 1 card played, trick 1, 1 card in trick
		expect(parsed.dmn.moveNumber).toBe(1);
		expect(parsed.dmn.number).toBe(1);
		expect(parsed.dmn.trickPlay).toBe(1);

		// C section: the played card
		expect(parsed.dmn.playedCard).toBe(firstCard);
		expect(parsed.dmn.playedBy).toBe(turnP!.position);
		expect(parsed.dmn.trickCards).toEqual([firstCard]);

		// H section: hand shrank by 1
		const handAfter = parsed.dmn.hands[`P${turnP!.position}`] ?? [];
		expect(handAfter.length).toBe(12);
		expect(handAfter).not.toContain(firstCard);
	});

	it("should round-trip: export → import → export produces identical DMN", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		// Play a few cards
		for (let i = 0; i < 4; i++) {
			if (game.isFinished) break;
			const turnP = game.currentPlayer;
			if (!turnP) break;
			const moves = game.getLegalMoves(turnP.id);
			const move = moves[0];
			if (move) {
				game.playCard({ playerPosition: turnP.position, card: move.card });
			}
		}

		const dmn1 = game.toDMN();
		const restored = fromDMN(dmn1) as Game;
		const dmn2 = restored.toDMN();

		expect(dmn2).toBe(dmn1);
	});

	it("should reconstruct a playable Game from DMN with correct hands", () => {
		const game = make4PGame();
		game.deal({ deck, playerPosition: 0 });

		// Play one card
		const turnP = game.currentPlayer!;
		const hand = game.state.hands[turnP.id] ?? [];
		const firstCard = hand[0]!;
		game.playCard({ playerPosition: turnP.position, card: firstCard });

		const dmn = game.toDMN();
		const restored = fromDMN(dmn) as Game;

		// Mode and phase match
		expect(restored.mode).toBe(game.mode);
		expect(restored.phase).toBe(game.phase);

		// Hands match
		expect(restored.state.hands).toEqual(game.state.hands);

		// Current trick matches
		expect(restored.currentTrick.cards.length).toBe(game.currentTrick.cards.length);
		expect(restored.currentTurup).toBe(game.currentTurup);

		// Game.fromDMN also works
		const restoredStatic = Game.fromDMN(dmn) as Game;
		expect(restoredStatic.mode).toBe(game.mode);
		expect(restoredStatic.state.hands).toEqual(game.state.hands);
	});

	it("should handle 2-Player game DMN with hands and stacks", () => {
		const game = Game.create({
			id: "dmn-2p",
			mode: "2P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "p1" },
				{ id: "p2", name: "Bob", position: 1, team: "p2" },
			],
		}) as Game;
		game.deal({ deck, playerPosition: 0 });

		const currP = game.currentPlayer;
		if (currP) {
			game.declareTurup({ playerPosition: currP.position, suit: "hearts" });
		}

		const dmn = game.toDMN();
		expect(dmn.startsWith("DMN1 G:2P,")).toBe(true);

		// H section should have P0[...] and P1[...]
		expect(dmn).toMatch(/H:P0\[.*\],P1\[.*\]/);

		// S section should have P0[S0[...|...],...],P1[S0[...|...],...]
		expect(dmn).toMatch(
			/S:P0\[S0\[.*\|.*\],S1\[.*\|.*\],S2\[.*\|.*\],S3\[.*\|.*\]\],P1\[S0\[.*\|.*\],S1\[.*\|.*\],S2\[.*\|.*\],S3\[.*\|.*\]\]/,
		);

		const parsed = importFromDMN(dmn);
		expect(parsed.dmn.mode).toBe("2P");
		expect(parsed.dmn.trumpSuit).toBe("hearts");

		// Hands should have 6 cards each
		expect(parsed.dmn.hands["P0"]?.length).toBe(6);
		expect(parsed.dmn.hands["P1"]?.length).toBe(6);

		// Stacks should be populated for both players
		expect(parsed.dmn.stacks2P).toBeDefined();
		const p1Stacks = parsed.dmn.stacks2P?.p1;
		const p2Stacks = parsed.dmn.stacks2P?.p2;
		expect(p1Stacks?.length).toBe(4);
		expect(p2Stacks?.length).toBe(4);

		// Each stack should have 4 hidden cards and 1 face-up card initially
		for (let s = 0; s < 4; s++) {
			expect(p1Stacks?.[s]?.position).toBe(s);
			expect(p1Stacks?.[s]?.hiddenCards.length).toBe(4);
			expect(p1Stacks?.[s]?.faceUpCard).toBeTruthy();

			expect(p2Stacks?.[s]?.position).toBe(s);
			expect(p2Stacks?.[s]?.hiddenCards.length).toBe(4);
			expect(p2Stacks?.[s]?.faceUpCard).toBeTruthy();
		}

		// Reconstructed game matches
		const restored = fromDMN(dmn) as Game;
		expect(restored.mode).toBe("2P");
		expect(restored.state.stacks2P.p1?.length).toBe(4);
		expect(restored.state.stacks2P.p2?.length).toBe(4);
		expect(restored.state.stacks2P).toEqual(game.state.stacks2P);
	});

	it("should encode trump suit in G section after turup declaration", () => {
		const game = Game.create({
			id: "dmn-turup",
			mode: "2P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "p1" },
				{ id: "p2", name: "Bob", position: 1, team: "p2" },
			],
		}) as Game;
		game.deal({ deck, playerPosition: 0 });

		const currP = game.currentPlayer;
		if (currP) {
			game.declareTurup({ playerPosition: currP.position, suit: "spades" });
		}

		const parsed = importFromDMN(game.toDMN());
		expect(parsed.dmn.trumpSuit).toBe("spades");

		// G section should show 's' for spades
		expect(game.toDMN()).toContain("G:2P,0,s");
	});

	it("should round-trip 2-Player DMN through export → import → export", () => {
		const game = Game.create({
			id: "dmn-2p-roundtrip",
			mode: "2P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "p1" },
				{ id: "p2", name: "Bob", position: 1, team: "p2" },
			],
		}) as Game;
		game.deal({ deck, playerPosition: 0 });

		const currP = game.currentPlayer!;
		game.declareTurup({ playerPosition: currP.position, suit: "diamonds" });

		const dmn1 = game.toDMN();
		const restored = fromDMN(dmn1) as Game;
		const dmn2 = restored.toDMN();

		expect(dmn2).toBe(dmn1);
	});

	it("should reconstruct playable 2-Player game and allow playing from stack", () => {
		const game = Game.create({
			id: "dmn-2p-play",
			mode: "2P",
			dealerPosition: 0,
			players: [
				{ id: "p1", name: "Alice", position: 0, team: "p1" },
				{ id: "p2", name: "Bob", position: 1, team: "p2" },
			],
		}) as Game;
		game.deal({ deck, playerPosition: 0 });

		const turnP = game.currentPlayer!;
		game.declareTurup({ playerPosition: turnP.position, suit: "clubs" });

		// Export after turup declaration
		const dmnInitial = game.toDMN();
		const restored = Game.fromDMN(dmnInitial) as Game;

		// Turn player plays a legal card (which may come from stack)
		const currentTurnPlayer = restored.currentPlayer!;
		const moves = restored.getLegalMoves(currentTurnPlayer.id);
		expect(moves.length).toBeGreaterThan(0);

		// Find a stack move
		const stackMove = moves.find((m) => m.stackPosition !== undefined);
		expect(stackMove).toBeDefined();

		if (stackMove) {
			const playRes = restored.playCard({ playerPosition: currentTurnPlayer.position, card: stackMove.card });
			expect(playRes.success).toBe(true);

			const dmnAfterPlay = restored.toDMN();
			const parsedAfterPlay = importFromDMN(dmnAfterPlay);

			// Stack position that was played should now have 3 hidden cards and a new face-up card
			const playerStacks = parsedAfterPlay.dmn.stacks2P?.[currentTurnPlayer.id];
			const modifiedStack = playerStacks?.[stackMove.stackPosition!];
			expect(modifiedStack?.hiddenCards.length).toBe(3);
			expect(modifiedStack?.faceUpCard).toBeTruthy();
			expect(modifiedStack?.faceUpCard).not.toBe(stackMove.card);
		}
	});

	it("should correctly parse stacks with empty hidden cards and null face-up cards", () => {
		const dmnString =
			"DMN1 G:2P,0,h H:P0[],P1[] S:P0[S0[|10s],S1[|-],S2[2h,5d|-],S3[|]],P1[S0[|-],S1[|-],S2[|-],S3[|-]] M:52,13,2 T:0,0,0 C:10s,0,0,1,[10s,9s]";
		const parsed = importFromDMN(dmnString);

		const p0Stacks = parsed.dmn.stacks2P?.p1;
		expect(p0Stacks?.[0]?.hiddenCards).toEqual([]);
		expect(p0Stacks?.[0]?.faceUpCard).toBe("10s");

		expect(p0Stacks?.[1]?.hiddenCards).toEqual([]);
		expect(p0Stacks?.[1]?.faceUpCard).toBeNull();

		expect(p0Stacks?.[2]?.hiddenCards).toEqual(["2h", "5d"]);
		expect(p0Stacks?.[2]?.faceUpCard).toBeNull();

		expect(p0Stacks?.[3]?.hiddenCards).toEqual([]);
		expect(p0Stacks?.[3]?.faceUpCard).toBeNull();
	});
});
