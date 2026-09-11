import { parseCard } from "./card";
import { DalMaraError } from "./errors";
import { createInitialScoreState } from "./scoring/scoring";

import type {
	Card,
	Ghopte,
	GameMode,
	GameState,
	PlayedCard,
	Player,
	Seat,
	PlayerStack,
	Suit,
	SuitAbbreviation,
	Trick,
	ScoreState,
} from "../types/index";

import { ABBREVIATION_TO_SUIT, ENGINE_ERROR_CODES, GAME_MODES, SUIT_ABBREVIATION } from "./const";

/**
 * Helpers
 */

function suitToToken(suit: Suit | null): string {
	if (!suit) return "-";
	return SUIT_ABBREVIATION[suit];
}

function tokenToSuit(token: string): Suit | null {
	if (!token || token === "-") return null;
	return ABBREVIATION_TO_SUIT[token as SuitAbbreviation] ?? null;
}

/**
 * Serialize DMN
 */

/**
 * Serialize a GameState into the pipe-separated DMN string format.
 *
 * Format:
 * <game> | <ghoptes> | <hands> | <stacks> | <move_number> | <trick> | <move_detail> | <next_move_seat>
 */
export function serializeDMN(state: GameState): string {
	const numPlayers = state.game.mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;

	// Section 1: Game
	const modeToken = state.game.mode;
	const dealerPos = String(state.game.dealerSeat);
	const turupToken = suitToToken(state.game.turup);
	const gameSection = `${modeToken},${dealerPos},${turupToken}`;

	// Section 2: Ghoptes
	let ghoptesSection: string;
	if (state.game.mode === GAME_MODES.TWO_PLAYER) {
		ghoptesSection = "-";
	} else {
		const groups: string[] = [];
		for (let pos = 0; pos < 4; pos++) {
			const playerGhoptes = state.ghoptes.filter((g) => g.seat === pos);
			if (playerGhoptes.length === 0) {
				groups.push("-");
			} else {
				const entries = playerGhoptes.map((g) => `${g.card},${g.order},${g.resolved ? "r" : "-"}`);
				groups.push(entries.join(":"));
			}
		}
		ghoptesSection = groups.join("/");
	}

	// Section 3: Hands
	const handParts: string[] = [];
	for (let i = 0; i < numPlayers; i++) {
		const hand = state.hands[i as Seat] ?? [];
		handParts.push(hand.join(",") || "");
	}
	const handsSection = handParts.join("/");

	// Section 4: Stacks
	let stacksSection: string;
	if (state.game.mode === GAME_MODES.FOUR_PLAYER) {
		stacksSection = "-";
	} else {
		const stackParts: string[] = [];
		for (let playerIdx = 0; playerIdx < 2; playerIdx++) {
			const playerStacks = state.stacks[playerIdx as Seat] ?? [];
			for (let s = 0; s < 4; s++) {
				const stack = playerStacks.find((st) => st.position === s);
				if (!stack || (stack.hiddenCards.length === 0 && !stack.faceUpCard)) {
					stackParts.push("-");
				} else {
					// Bottom-to-top: hidden cards then face-up card
					const cards = [...stack.hiddenCards];
					if (stack.faceUpCard) {
						cards.push(stack.faceUpCard);
					}
					stackParts.push(cards.join(","));
				}
			}
		}
		stacksSection = stackParts.join("/");
	}

	// Section 5: Move Number
	const moveNumberSection = String(state.moveNumber);

	// Section 6: Trick
	const trickNumber = state.trick.number;
	const playNumber = state.trick.playNumber;
	const leadSuitToken = suitToToken(state.trick.leadSuit);
	const ghopteFlag = state.trick.isGhopte ? "g" : "-";

	let trickCardsToken: string;
	if (state.trick.cards.length === 0) {
		trickCardsToken = "-";
	} else {
		const cardEntries = state.trick.cards.map((pc) => {
			return `${pc.seat}:${pc.card}`;
		});
		trickCardsToken = cardEntries.join("/");
	}
	const trickSection = `${trickNumber},${playNumber},${leadSuitToken},${ghopteFlag},${trickCardsToken}`;

	// Section 7: Move Detail
	let moveDetailSection: string;
	if (state.moveDetail.seat === null || state.moveDetail.card === null) {
		moveDetailSection = "-,-,-";
	} else {
		const makesTurupToken = state.moveDetail.makesTurup ? "t" : "-";
		moveDetailSection = `${state.moveDetail.seat},${state.moveDetail.card},${makesTurupToken}`;
	}

	// Section 8: Next Move Seat
	const nextMoveSection = String(state.nextMoveSeat);

	return `${gameSection} | ${ghoptesSection} | ${handsSection} | ${stacksSection} | ${moveNumberSection} | ${trickSection} | ${moveDetailSection} | ${nextMoveSection}`;
}

/**
 * Parse DMN
 */

/**
 * Parse a pipe-separated DMN string into a GameState.
 *
 * Format:
 * <game> | <ghoptes> | <hands> | <stacks> | <move_number> | <trick> | <move_detail> | <next_move_seat>
 */
export function parseDMN(dmn: string): GameState {
	const trimmed = dmn.trim();
	const sections = trimmed.split(" | ");

	if (sections.length !== 8) {
		throw new DalMaraError(
			`Invalid DMN string: expected 8 pipe-separated sections, got ${sections.length}`,
			ENGINE_ERROR_CODES.INVALID_DMN,
		);
	}

	const [gameRaw, ghoptesRaw, handsRaw, stacksRaw, moveNumberRaw, trickRaw, moveDetailRaw, nextMoveRaw] = sections;

	// Section 1: Game
	const gameParts = gameRaw.split(",");
	if (gameParts.length !== 3) {
		throw new DalMaraError("Invalid DMN game section", ENGINE_ERROR_CODES.INVALID_DMN);
	}
	const mode: GameMode = gameParts[0] === GAME_MODES.TWO_PLAYER ? GAME_MODES.TWO_PLAYER : GAME_MODES.FOUR_PLAYER;
	const dealerSeat = parseInt(gameParts[1], 10) as Seat;
	const turup = tokenToSuit(gameParts[2]);

	// Construct players
	const numPlayers = mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;
	const players: Player[] = [];
	for (let i = 0; i < numPlayers; i++) {
		players.push({
			seat: i as Seat,
			team: mode === GAME_MODES.FOUR_PLAYER ? (i % 2 === 0 ? "02" : "13") : String(i),
		});
	}

	// Section 2: Ghoptes
	const ghoptes: Ghopte[] = [];
	if (ghoptesRaw !== "-" && mode === GAME_MODES.FOUR_PLAYER) {
		const playerGroups = ghoptesRaw.split("/");
		for (let pos = 0; pos < playerGroups.length; pos++) {
			const group = playerGroups[pos];
			if (group === "-" || !group) continue;

			const entries = group.split(":");
			for (const entry of entries) {
				const parts = entry.split(",");
				if (parts.length !== 3) continue;

				const card = parts[0] as Card;
				const order = parseInt(parts[1], 10);
				const resolved = parts[2] === "r";

				ghoptes.push({
					seat: pos as Seat,
					card,
					order,
					resolved,
				});
			}
		}
	}

	// Section 3: Hands
	const hands = {} as Record<Seat, readonly Card[]>;
	const handSegments = handsRaw.split("/");
	for (let i = 0; i < numPlayers; i++) {
		const segment = handSegments[i] ?? "";
		hands[i as Seat] = segment ? (segment.split(",") as Card[]) : [];
	}

	// Section 4: Stacks
	const stacks = {} as Record<Seat, readonly PlayerStack[]>;
	if (stacksRaw !== "-" && mode === GAME_MODES.TWO_PLAYER) {
		const stackSlots = stacksRaw.split("/");
		// First 4 = player 0, next 4 = player 1
		for (let playerIdx = 0; playerIdx < 2; playerIdx++) {
			const playerStacks: PlayerStack[] = [];
			for (let s = 0; s < 4; s++) {
				const slotIdx = playerIdx * 4 + s;
				const slotRaw = stackSlots[slotIdx] ?? "-";
				if (slotRaw === "-") {
					playerStacks.push({ position: s, hiddenCards: [], faceUpCard: null });
				} else {
					const cards = slotRaw.split(",") as Card[];
					// Last card is face-up, rest are hidden (bottom-to-top)
					if (cards.length === 0) {
						playerStacks.push({ position: s, hiddenCards: [], faceUpCard: null });
					} else {
						const faceUpCard = cards[cards.length - 1] ?? null;
						const hiddenCards = cards.slice(0, -1);
						playerStacks.push({ position: s, hiddenCards, faceUpCard });
					}
				}
			}
			stacks[playerIdx as Seat] = playerStacks;
		}
	}

	// Section 5: Move Number
	const moveNumber = parseInt(moveNumberRaw, 10);

	// Section 6: Trick
	// Format: <trick_number>,<play_number>,<lead_suit>,<ghopte_flag>,<trick_cards>
	const trickParts = trickRaw.split(",");
	const trickNumber = parseInt(trickParts[0], 10);
	const playNumber = parseInt(trickParts[1], 10);
	const leadSuit = tokenToSuit(trickParts[2]);
	const ghopteFlag = trickParts[3] === "g";

	// Trick cards: everything after the 4th comma is the trick cards portion
	// Format: <pos>:<card>/<pos>:<card>/...  or  -
	const trickCardsPart = trickParts.slice(4).join(","); // rejoin in case card has no commas — but trick cards use / separator
	const trickCards: PlayedCard[] = [];
	if (trickCardsPart && trickCardsPart !== "-") {
		const cardEntries = trickCardsPart.split("/");
		for (let idx = 0; idx < cardEntries.length; idx++) {
			const entry = cardEntries[idx];
			const colonIdx = entry.indexOf(":");
			if (colonIdx === -1) continue;
			const pos = parseInt(entry.slice(0, colonIdx), 10) as Seat;
			const card = entry.slice(colonIdx + 1) as Card;
			trickCards.push({
				seat: pos,
				card,
				playOrder: idx + 1,
			});
		}
	}

	const trick: Trick = {
		number: trickNumber,
		playNumber,
		leadSuit,
		isGhopte: ghopteFlag,
		cards: trickCards,
	};

	// Section 7: Move Detail
	const moveDetailParts = moveDetailRaw.split(",");
	const movePlayerSeat = moveDetailParts[0] !== "-" ? (parseInt(moveDetailParts[0], 10) as Seat) : null;
	const moveCard = moveDetailParts[1] !== "-" ? (moveDetailParts[1] as Card) : null;
	const moveMakesTurup = moveDetailParts[2] === "t";

	// Section 8: Next Move Seat
	const nextMoveSeat = parseInt(nextMoveRaw, 10) as Seat;

	return {
		game: {
			mode,
			dealerSeat,
			turup,
		},
		players,
		hands,
		ghoptes,
		stacks,
		moveNumber,
		trick,
		moveDetail: {
			seat: movePlayerSeat,
			card: moveCard,
			makesTurup: moveMakesTurup,
		},
		nextMoveSeat,
	};
}
