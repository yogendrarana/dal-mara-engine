import { describe, expect, it } from "vitest";
import {
	createDeck,
	createGame,
	deal,
	playCard,
	declareTurup,
	parseDMN,
	serializeDMN,
	getLegalMoves,
	getCurrentPlayer,
} from "../src";
import type { GameState } from "../src";

const deck = createDeck();

const make4PGame = () => {
	const result = createGame({
		mode: "4p",
		dealerPosition: 0,
		players: [
			{ position: 0, team: "red" },
			{ position: 1, team: "blue" },
			{ position: 2, team: "red" },
			{ position: 3, team: "blue" },
		],
	});
	if (!result.success) throw new Error("Failed to create game");
	return result;
};

describe("Dal Mara Notation (DMN) - Pipe-Separated Format", () => {
	it("should produce initial DMN immediately on game creation (pre-deal)", () => {
		const result = make4PGame();
		expect(result.success).toBe(true);
		expect(result.dmn).toBeDefined();
		expect(typeof result.dmn).toBe("string");

		// Should have 8 pipe-separated sections
		const sections = result.dmn.split(" | ");
		expect(sections.length).toBe(8);

		// Game section
		expect(sections[0]).toBe("4p,0,-");

		// next_move_player_position = dealer (0) before deal
		expect(sections[7]).toBe("0");
	});

	it("should export DMN with all 8 sections after dealing", () => {
		const { state: initState } = make4PGame();
		const result = deal(initState, { deck, playerPosition: 0 });
		if (!result.success) throw new Error("Deal failed");

		const sections = result.dmn.split(" | ");
		expect(sections.length).toBe(8);

		// Game section: 4p mode, dealer 0, no turup yet
		expect(sections[0]).toBe("4p,0,-");

		// Move number = 0
		expect(sections[4]).toBe("0");

		// Move detail: no move yet
		expect(sections[6]).toBe("-,-,-");
	});

	it("should encode hands as slash-separated player segments", () => {
		const { state: initState } = make4PGame();
		const result = deal(initState, { deck, playerPosition: 0 });
		if (!result.success) throw new Error("Deal failed");

		const sections = result.dmn.split(" | ");
		const handsSection = sections[2];
		const handSegments = handsSection.split("/");

		// 4 players = 4 segments
		expect(handSegments.length).toBe(4);

		// Each player has 13 cards
		for (const segment of handSegments) {
			const cards = segment.split(",");
			expect(cards.length).toBe(13);
		}
	});

	it("should use - for ghoptes in 2p mode", () => {
		const result = createGame({
			mode: "2p",
			dealerPosition: 0,
			players: [
				{ position: 0, team: "p1" },
				{ position: 1, team: "p2" },
			],
		});
		if (!result.success) throw new Error("Failed");

		const sections = result.dmn.split(" | ");
		expect(sections[1]).toBe("-");
	});

	it("should use - for stacks in 4p mode", () => {
		const { state: initState } = make4PGame();
		const result = deal(initState, { deck, playerPosition: 0 });
		if (!result.success) throw new Error("Deal failed");

		const sections = result.dmn.split(" | ");
		expect(sections[3]).toBe("-");
	});

	it("should round-trip: serializeDMN → parseDMN → serializeDMN produces identical DMN", () => {
		const { state: initState } = make4PGame();
		const dealResult = deal(initState, { deck, playerPosition: 0 });
		if (!dealResult.success) throw new Error("Deal failed");

		// Play a few cards
		let currentState = dealResult.state;
		for (let i = 0; i < 4; i++) {
			const player = getCurrentPlayer(currentState);
			if (!player) break;
			const moves = getLegalMoves(currentState, player.position);
			const move = moves[0];
			if (!move) break;

			const playResult = playCard(currentState, { playerPosition: player.position, card: move.card });
			if (!playResult.success) break;
			currentState = playResult.state;
		}

		const dmn1 = serializeDMN(currentState);
		const parsed = parseDMN(dmn1);
		const dmn2 = serializeDMN(parsed);

		expect(dmn2).toBe(dmn1);
	});

	it("should update DMN after playing a card", () => {
		const { state: initState } = make4PGame();
		const dealResult = deal(initState, { deck, playerPosition: 0 });
		if (!dealResult.success) throw new Error("Deal failed");

		const turnPlayer = getCurrentPlayer(dealResult.state);
		expect(turnPlayer).not.toBeNull();

		const hand = dealResult.state.hands[turnPlayer!.position] ?? [];
		const firstCard = hand[0]!;
		const playResult = playCard(dealResult.state, { playerPosition: turnPlayer!.position, card: firstCard });
		if (!playResult.success) throw new Error("Play failed");

		const sections = playResult.dmn.split(" | ");

		// Move number = 1
		expect(sections[4]).toBe("1");

		// Trick section: trick 1, play 1
		const trickParts = sections[5].split(",");
		expect(trickParts[0]).toBe("1"); // trick number
		expect(trickParts[1]).toBe("1"); // play number

		// Move detail: player position, card, no turup
		const moveDetailParts = sections[6].split(",");
		expect(moveDetailParts[0]).toBe(String(turnPlayer!.position));
		expect(moveDetailParts[1]).toBe(firstCard);
		expect(moveDetailParts[2]).toBe("-");

		// Hand shrank by 1
		const parsed = parseDMN(playResult.dmn);
		const handAfter = parsed.hands[turnPlayer!.position] ?? [];
		expect(handAfter.length).toBe(12);
		expect(handAfter).not.toContain(firstCard);
	});

	it("should handle 2p mode with stacks and turup", () => {
		const result = createGame({
			mode: "2p",
			dealerPosition: 0,
			players: [
				{ position: 0, team: "p1" },
				{ position: 1, team: "p2" },
			],
		});
		if (!result.success) throw new Error("Failed");

		const dealResult = deal(result.state, { deck, playerPosition: 0 });
		if (!dealResult.success) throw new Error("Deal failed");

		const currP = getCurrentPlayer(dealResult.state);
		expect(currP).not.toBeNull();

		const turupResult = declareTurup(dealResult.state, { playerPosition: currP!.position, suit: "hearts" });
		if (!turupResult.success) throw new Error("Turup failed");

		const sections = turupResult.dmn.split(" | ");

		// Game section has turup
		expect(sections[0]).toContain(",h");

		// Ghoptes = -
		expect(sections[1]).toBe("-");

		// Hands section has 2 segments
		const handSegments = sections[2].split("/");
		expect(handSegments.length).toBe(2);
		for (const segment of handSegments) {
			const cards = segment.split(",");
			expect(cards.length).toBe(6);
		}

		// Stacks section has 8 slots
		const stackSlots = sections[3].split("/");
		expect(stackSlots.length).toBe(8);

		// Each stack should have 5 cards (4 hidden + 1 face-up)
		for (const slot of stackSlots) {
			expect(slot).not.toBe("-");
			const cards = slot.split(",");
			expect(cards.length).toBe(5);
		}

		// Round-trip 2P
		const dmn1 = turupResult.dmn;
		const parsed = parseDMN(dmn1);
		const dmn2 = serializeDMN(parsed);
		expect(dmn2).toBe(dmn1);
	});

	it("should encode trick cards in DMN with player position format", () => {
		const { state: initState } = make4PGame();
		const dealResult = deal(initState, { deck, playerPosition: 0 });
		if (!dealResult.success) throw new Error("Deal failed");

		const player = getCurrentPlayer(dealResult.state);
		if (!player) throw new Error("No current player");

		const hand = dealResult.state.hands[player.position] ?? [];
		const playResult = playCard(dealResult.state, { playerPosition: player.position, card: hand[0]! });
		if (!playResult.success) throw new Error("Play failed");

		const sections = playResult.dmn.split(" | ");
		const trickParts = sections[5].split(",");

		// Trick cards (5th element onwards): format is <pos>:<card>
		const trickCardsPart = trickParts.slice(4).join(",");
		expect(trickCardsPart).toContain(":");
		expect(trickCardsPart).toContain(String(player.position));
	});

	it("should encode and decode ghoptes in position-grouped format", () => {
		// Craft a DMN string with ghoptes to test parsing
		const dmnWithGhopte =
			"4p,0,- | -/Kh,1,-:7s,1,-/Qd,2,-/- | As,Qh,10d,2c,3h,4d,5c,6h,7d,8c,9h,Jd,Qc/2s,3s,4s,5s,6s,7s,8s,9s,Js,Qs,Ks,As,2h/2d,3d,4d,5d,6d,7d,8d,9d,Jd,Qd,Kd,Ad,3c/4c,5c,6c,7c,8c,9c,Jc,Qc,Kc,Ac,4h,5h,6h | - | 0 | 1,0,s,g,- | -,-,- | 1";
		const parsed = parseDMN(dmnWithGhopte);

		expect(parsed.ghoptes).toHaveLength(3);

		// Player 0: no ghoptes
		expect(parsed.ghoptes.filter((g) => g.playerPosition === 0)).toHaveLength(0);

		// Player 1: 2 ghoptes with order 1
		const p1Ghoptes = parsed.ghoptes.filter((g) => g.playerPosition === 1);
		expect(p1Ghoptes).toHaveLength(2);
		expect(p1Ghoptes[0]?.card).toBe("Kh");
		expect(p1Ghoptes[0]?.order).toBe(1);
		expect(p1Ghoptes[0]?.resolved).toBe(false);
		expect(p1Ghoptes[1]?.card).toBe("7s");

		// Player 2: 1 ghopte with order 2
		const p2Ghoptes = parsed.ghoptes.filter((g) => g.playerPosition === 2);
		expect(p2Ghoptes).toHaveLength(1);
		expect(p2Ghoptes[0]?.card).toBe("Qd");
		expect(p2Ghoptes[0]?.order).toBe(2);

		// Player 3: no ghoptes
		expect(parsed.ghoptes.filter((g) => g.playerPosition === 3)).toHaveLength(0);

		// Round-trip
		const reserialized = serializeDMN(parsed);
		const reparsed = parseDMN(reserialized);
		expect(reparsed.ghoptes).toEqual(parsed.ghoptes);
	});

	it("should always populate next_move_player_position", () => {
		// At creation
		const { dmn: initDmn, state: initState } = make4PGame();
		const initSections = initDmn.split(" | ");
		expect(initSections[7]).not.toBe("-");
		expect(parseInt(initSections[7], 10)).toBeGreaterThanOrEqual(0);

		// After deal
		const dealResult = deal(initState, { deck, playerPosition: 0 });
		if (!dealResult.success) throw new Error("Deal failed");
		const dealSections = dealResult.dmn.split(" | ");
		expect(dealSections[7]).not.toBe("-");

		// After play
		const player = getCurrentPlayer(dealResult.state);
		if (!player) throw new Error("No player");
		const hand = dealResult.state.hands[player.position] ?? [];
		const playResult = playCard(dealResult.state, { playerPosition: player.position, card: hand[0]! });
		if (!playResult.success) throw new Error("Play failed");
		const playSections = playResult.dmn.split(" | ");
		expect(playSections[7]).not.toBe("-");
	});
});
