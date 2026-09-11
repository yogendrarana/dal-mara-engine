import { describe, expect, it } from "vitest";
import {
	createDeck,
	createGame,
	dealFourPlayer,
	dealTwoPlayerHands,
	dealTwoPlayerStacks,
	getRemainingCards2P,
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
		dealerSeat: 0,
		players: [
			{ seat: 0, team: "red" },
			{ seat: 1, team: "blue" },
			{ seat: 2, team: "red" },
			{ seat: 3, team: "blue" },
		],
	});
	if (!result.success) throw new Error("Failed to create game");
	return result;
};

describe("Dal Mara Notation (DMN) - Pipe-Separated Format", () => {
	it("should produce initial DMN immediately on game creation (pre-deal)", () => {
		const { dmn, state } = make4PGame();
		expect(dmn).toBeDefined();

		const sections = dmn.split(" | ");
		expect(sections.length).toBe(8);

		// Section 1: 4p,0,- (mode=4p, dealer=0, turup=-)
		expect(sections[0]).toBe("4p,0,-");

		// Section 2: ghoptes = -/-/-/- in 4p
		expect(sections[1]).toBe("-/-/-/-");

		// Section 3: hands = /// (4 empty seats)
		expect(sections[2]).toBe("///");

		// next_move_seat = dealer (0) before deal
		expect(sections[7]).toBe("0");
	});

	it("should export DMN with all 8 sections after dealing", () => {
		const { state: initState } = make4PGame();
		const result = dealFourPlayer(initState, { deck, seat: 0 });
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
		const result = dealFourPlayer(initState, { deck, seat: 0 });
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
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "p1" },
				{ seat: 1, team: "p2" },
			],
		});
		if (!result.success) throw new Error("Failed");

		const sections = result.dmn.split(" | ");
		expect(sections[1]).toBe("-");
	});

	it("should use - for stacks in 4p mode", () => {
		const { state: initState } = make4PGame();
		const result = dealFourPlayer(initState, { deck, seat: 0 });
		if (!result.success) throw new Error("Deal failed");

		const sections = result.dmn.split(" | ");
		expect(sections[3]).toBe("-");
	});

	it("should round-trip: serializeDMN → parseDMN → serializeDMN produces identical DMN", () => {
		const { state: initState } = make4PGame();
		const dealResult = dealFourPlayer(initState, { deck, seat: 0 });
		if (!dealResult.success) throw new Error("Deal failed");

		// Play a few cards
		let currentState = dealResult.state;
		for (let i = 0; i < 4; i++) {
			const player = getCurrentPlayer(currentState);
			if (!player) break;
			const moves = getLegalMoves(currentState, player.seat);
			const move = moves[0];
			if (!move) break;

			const playResult = playCard(currentState, { seat: player.seat, card: move.card });
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
		const dealResult = dealFourPlayer(initState, { deck, seat: 0 });
		if (!dealResult.success) throw new Error("Deal failed");

		const turnPlayer = getCurrentPlayer(dealResult.state);
		expect(turnPlayer).not.toBeNull();

		const hand = dealResult.state.hands[turnPlayer!.seat] ?? [];
		const firstCard = hand[0]!;

		const playResult = playCard(dealResult.state, { seat: turnPlayer!.seat, card: firstCard });
		if (!playResult.success) throw new Error("Play card failed");

		const dmnAfter = playResult.dmn;
		expect(dmnAfter).not.toBe(dealResult.dmn);

		const sections = dmnAfter.split(" | ");

		// Move number incremented
		expect(sections[4]).toBe("1");

		// Move detail contains player seat and card
		expect(sections[6]).toContain(String(turnPlayer!.seat));
		expect(sections[6]).toContain(firstCard);

		// Hand no longer contains that card
		const handAfter = playResult.state.hands[turnPlayer!.seat] ?? [];
		expect(handAfter).not.toContain(firstCard);
	});

	it("should handle 2p mode with stacks and turup", () => {
		const result = createGame({
			mode: "2p",
			dealerSeat: 0,
			players: [
				{ seat: 0, team: "p1" },
				{ seat: 1, team: "p2" },
			],
		});
		if (!result.success) throw new Error("Failed");

		const handResult = dealTwoPlayerHands(result.state, { deck, seat: 0 });
		if (!handResult.success) throw new Error("Hand deal failed");

		const currP = getCurrentPlayer(handResult.state);
		expect(currP).not.toBeNull();

		const turupResult = declareTurup(handResult.state, { seat: currP!.seat, suit: "hearts" });
		if (!turupResult.success) throw new Error("Turup failed");

		const remaining40 = getRemainingCards2P(turupResult.state, deck);
		const stackDealer = getCurrentPlayer(turupResult.state);
		const stackResult = dealTwoPlayerStacks(turupResult.state, { deck: remaining40, seat: stackDealer!.seat });
		if (!stackResult.success) throw new Error("Stack deal failed");

		const sections = stackResult.dmn.split(" | ");

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
		const dmn1 = stackResult.dmn;
		const parsed = parseDMN(dmn1);
		const dmn2 = serializeDMN(parsed);
		expect(dmn2).toBe(dmn1);
	});

	it("should encode trick cards in DMN with player seat format", () => {
		const { state: initState } = make4PGame();
		const dealResult = dealFourPlayer(initState, { deck, seat: 0 });
		if (!dealResult.success) throw new Error("Deal failed");

		const player = getCurrentPlayer(dealResult.state);
		if (!player) throw new Error("No current player");

		const hand = dealResult.state.hands[player.seat] ?? [];
		const playResult = playCard(dealResult.state, { seat: player.seat, card: hand[0]! });
		if (!playResult.success) throw new Error("Play failed");

		const sections = playResult.dmn.split(" | ");
		const trickParts = sections[5].split(",");

		// Trick cards (5th element onwards): format is <seat>:<card>
		const trickCardsPart = trickParts.slice(4).join(",");
		expect(trickCardsPart).toContain(":");
		expect(trickCardsPart).toContain(String(player.seat));
	});

	it("should encode and decode ghoptes in position-grouped format", () => {
		// Craft a DMN string with ghoptes to test parsing
		const dmnWithGhopte =
			"4p,0,- | -/10s,1,-/-/10h,2,- | 2s,3s,4s,5s,6s,7s,8s,9s,Js,Qs,Ks,As,2h/3h,4h,5h,6h,7h,8h,9h,Jh,Qh,Kh,Ah,2d,3d/4d,5d,6d,7d,8d,9d,10d,Jd,Qd,Kd,Ad,2c,3c/4c,5c,6c,7c,8c,9c,10c,Jc,Qc,Kc,Ac,10s,10h | - | 0 | 1,0,-,-,- | -,-,- | 1";

		const parsed = parseDMN(dmnWithGhopte);
		expect(parsed.ghoptes.length).toBeGreaterThan(0);

		// Player 1 has 10s with order 1
		const p1Ghoptes = parsed.ghoptes.filter((g) => g.seat === 1);
		expect(p1Ghoptes).toHaveLength(1);
		expect(p1Ghoptes[0]?.card).toBe("10s");
		expect(p1Ghoptes[0]?.order).toBe(1);

		// Player 3 has 10h with order 2
		const p3Ghoptes = parsed.ghoptes.filter((g) => g.seat === 3);
		expect(p3Ghoptes).toHaveLength(1);
		expect(p3Ghoptes[0]?.card).toBe("10h");
		expect(p3Ghoptes[0]?.order).toBe(2);

		// Round-trip
		const reserialized = serializeDMN(parsed);
		const reparsed = parseDMN(reserialized);
		expect(reparsed.ghoptes).toEqual(parsed.ghoptes);
	});

	it("should always populate next_move_seat", () => {
		// At creation
		const { dmn: initDmn, state: initState } = make4PGame();
		const initSections = initDmn.split(" | ");
		expect(initSections[7]).not.toBe("-");
		expect(parseInt(initSections[7], 10)).toBeGreaterThanOrEqual(0);

		// After deal
		const dealResult = dealFourPlayer(initState, { deck, seat: 0 });
		if (!dealResult.success) throw new Error("Deal failed");
		const dealSections = dealResult.dmn.split(" | ");
		expect(dealSections[7]).not.toBe("-");

		// After play
		const player = getCurrentPlayer(dealResult.state);
		if (!player) throw new Error("No player");
		const hand = dealResult.state.hands[player.seat] ?? [];
		const playResult = playCard(dealResult.state, { seat: player.seat, card: hand[0]! });
		if (!playResult.success) throw new Error("Play failed");
		const playSections = playResult.dmn.split(" | ");
		expect(playSections[7]).not.toBe("-");
	});
});
