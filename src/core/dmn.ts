import { parseCard } from "./card";

import type {
	Card,
	GameMode,
	GamePhase,
	GameState,
	PlayedCard,
	Player,
	PlayerPosition,
	PlayerStack2P,
	Suit,
	SuitAbbreviation,
	Trick,
	ValidationResult,
} from "../types/index";

import { Game } from "./game";
import { DalMaraError } from "./errors";
import { ABBREVIATION_TO_SUIT, ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES, SUIT_ABBREVIATION } from "./const";

// Dal Mara Notation (DMN) - Version 1
//
// DMN1 is a self-contained game state snapshot format.
// Every DMN string contains enough information to reconstruct a full playable Game without any database lookup.
//
// Format:
// DMN1 G:<GameInfo> H:<Hands> S:<Stacks> M:<MoveInfo> T:<TrickInfo> C:<CardInfo>
//
// Sections:
//   G:<Mode>,<DealerPosition>,<TrumpSuit>
//   H:P0[<Cards>],P1[<Cards>],P2[<Cards>],P3[<Cards>]  (4P)
//   H:P0[<Cards>],P1[<Cards>]                          (2P)
//   S:-                                                (4P)
//   S:P0[S0[<Hidden>|<FaceUp>],...],P1[...]           (2P)
//   M:<MoveNumber>,<TrickNumber>,<TrickPlay>
//   T:<TrickLeader>,<NextTrickLeader>,<IsGhopte>
//   C:<PlayedCard>,<PlayedBy>,<IsGhopte>,<IsTurup>,[<TrickCards>]
//
// Card format uses engine Card directly: 2s, 10h, Js, Qd, Ac
// "-" represents no value / not applicable
//
// Game flow:
//   1 initial DMN after dealing (moveNumber=0)
//   1 DMN after every card play
//   For a 52-card 4P game: 1 initial + 52 moves = 53 DMN snapshots
//
// Example (4P initial state after deal):
//   DMN1 G:4P,0,- H:P0[2s,3s,...],P1[...],P2[...],P3[...] S:- M:0,0,0 T:1,-,0 C:-,-,0,0,[]
//
// Example (2P state with stacks):
//   DMN1 G:2P,0,s H:P0[2s,6c,10h,As,Qd,Kh],P1[3s,7d,Jh,Qc,5h,9s] S:P0[S0[2h,5d,7c,Kh|10s],S1[4c,8s,6h,9d|Qs],S2[3d,8c,Jc,Ac|4h],S3[5s,7h,Kd,2c|Ad]],P1[S0[...|9c],S1[...|Jh],S2[...|Kd],S3[...|2d]] M:0,0,0 T:1,-,0 C:-,-,0,0,[]

export interface DMNState {
	readonly version: string;
	// G section
	readonly mode: GameMode;
	readonly dealerPosition: PlayerPosition;
	readonly trumpSuit: Suit | null;
	// H section
	readonly hands: Record<string, readonly Card[]>;
	// S section
	readonly stacks2P: Record<string, readonly PlayerStack2P[]> | null;
	// M section
	readonly moveNumber: number;
	readonly trickNumber: number;
	readonly trickPlay: number;
	// T section
	readonly trickLeader: number | null;
	readonly nextTrickLeader: number | null;
	readonly isGhopteTrick: boolean;
	// C section
	readonly playedCard: Card | null;
	readonly playedBy: number | null;
	readonly isGhopteCard: boolean;
	readonly isTurup: boolean;
	readonly trickCards: readonly Card[];
}

// ---------------------------------------------------------------------------
// Card conversion helpers
// ---------------------------------------------------------------------------

/** Convert a Card string to its DMN token representation */
export function cardToDMN(card: Card | null): string {
	return card ?? "-";
}

/** Convert a DMN token back to a Card string */
export function dmnToCard(token: string): Card | null {
	if (!token || token === "-") return null;
	return token as Card;
}

function suitToDMN(suit: Suit | null): string {
	if (!suit) return "-";
	return SUIT_ABBREVIATION[suit];
}

function dmnToSuit(token: string): Suit | null {
	if (!token || token === "-") return null;
	return ABBREVIATION_TO_SUIT[token as SuitAbbreviation] ?? null;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportToDMN(state: GameState): string {
	const version = "DMN1";
	const numPlayers = state.mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;

	// --- G section: Game info ---
	const modeToken = state.mode === GAME_MODES.FOUR_PLAYER ? "4P" : "2P";
	const dealerPos = String(state.dealerPosition);
	const trumpToken = suitToDMN(state.currentTurup);
	const gSection = `G:${modeToken},${dealerPos},${trumpToken}`;

	// --- H section: Player hands ---
	const handParts: string[] = [];
	for (let i = 0; i < numPlayers; i++) {
		const player = state.players.find((p) => p.position === i);
		const hand = player ? (state.hands[player.id] ?? []) : [];
		const cardIds = hand.join(",");
		handParts.push(`P${i}[${cardIds}]`);
	}
	const hSection = `H:${handParts.join(",")}`;

	// --- S section: Stacks ---
	let sSection = "S:-";
	if (state.mode === GAME_MODES.TWO_PLAYER) {
		const playerStackParts: string[] = [];
		for (let i = 0; i < 2; i++) {
			const player = state.players.find((p) => p.position === i);
			const stacks = player ? (state.stacks2P[player.id] ?? []) : [];
			const stackTokens: string[] = [];
			for (let s = 0; s < 4; s++) {
				const stack = stacks.find((st) => st.position === s);
				const hiddenStr = stack ? stack.hiddenCards.join(",") : "";
				const faceUpStr = stack?.faceUpCard ?? "-";
				stackTokens.push(`S${s}[${hiddenStr}|${faceUpStr}]`);
			}
			playerStackParts.push(`P${i}[${stackTokens.join(",")}]`);
		}
		sSection = `S:${playerStackParts.join(",")}`;
	}

	// --- M section: Move info ---
	// moveNumber = total cards played so far (computed from hands)
	const totalCardsInHands = Object.values(state.hands).reduce((sum, h) => sum + h.length, 0);
	const totalCardsInStacks = Object.values(state.stacks2P).reduce(
		(sum, stacks) => sum + stacks.reduce((s, stack) => s + stack.hiddenCards.length + (stack.faceUpCard ? 1 : 0), 0),
		0,
	);
	const totalUnplayed = totalCardsInHands + totalCardsInStacks;
	const moveNumber = totalUnplayed > 0 && totalUnplayed < 52 ? 52 - totalUnplayed : totalUnplayed === 0 ? 0 : 0;

	// trickNumber: 0 for initial state (no moves yet), else current trick number
	const trickNumber = moveNumber === 0 ? 0 : state.currentTrick.trickNumber;
	const trickPlay = state.currentTrick.cards.length;

	const mSection = `M:${moveNumber},${trickNumber},${trickPlay}`;

	// --- T section: Trick info ---
	let trickLeaderToken = "-";
	let nextTrickLeaderToken = "-";
	const isGhopteTrickToken = state.phase === GAME_PHASES.GHOPTE ? "1" : "0";

	if (state.currentTrick.cards.length > 0) {
		// Trick has cards — leader is the first card's player
		const leaderPlayerId = state.currentTrick.cards[0]?.playerId;
		if (leaderPlayerId) {
			const leaderPlayer = state.players.find((p) => p.id === leaderPlayerId);
			if (leaderPlayer) {
				trickLeaderToken = String(leaderPlayer.position);
			}
		}
	} else if (state.currentTurnPlayerId) {
		// Empty trick — the current turn player will lead
		const turnPlayer = state.players.find((p) => p.id === state.currentTurnPlayerId);
		if (turnPlayer) {
			trickLeaderToken = String(turnPlayer.position);
		}
	}

	if (state.currentTurnPlayerId) {
		const turnPlayer = state.players.find((p) => p.id === state.currentTurnPlayerId);
		if (turnPlayer) {
			nextTrickLeaderToken = String(turnPlayer.position);
		}
	}

	const tSection = `T:${trickLeaderToken},${nextTrickLeaderToken},${isGhopteTrickToken}`;

	// --- C section: Card info ---
	let playedCardToken = "-";
	let playedByToken = "-";
	let isGhopteCardToken = "0";
	let isTurupToken = "0";
	let trickCardsToken = "[]";

	const trickCards = state.currentTrick.cards;
	if (trickCards.length > 0) {
		// Last played card in current trick
		const lastPlay = trickCards[trickCards.length - 1];
		if (lastPlay) {
			playedCardToken = lastPlay.card;
			const playedByPlayer = state.players.find((p) => p.id === lastPlay.playerId);
			if (playedByPlayer) {
				playedByToken = String(playedByPlayer.position);
			}
			isGhopteCardToken = state.phase === GAME_PHASES.GHOPTE ? "1" : "0";
			isTurupToken = state.currentTurup === parseCard(lastPlay.card).suit ? "1" : "0";
		}
		const cardList = trickCards.map((pc) => pc.card).join(",");
		trickCardsToken = `[${cardList}]`;
	}

	const cSection = `C:${playedCardToken},${playedByToken},${isGhopteCardToken},${isTurupToken},${trickCardsToken}`;

	return `${version} ${gSection} ${hSection} ${sSection} ${mSection} ${tSection} ${cSection}`;
}

export function toDMN(stateOrGame: GameState | Game): string {
	if ("state" in stateOrGame && stateOrGame.state) {
		return exportToDMN(stateOrGame.state);
	}
	return exportToDMN(stateOrGame as GameState);
}

// ---------------------------------------------------------------------------
// Import / parsing helpers
// ---------------------------------------------------------------------------

function parseSectionValue(sections: Map<string, string>, key: string): string {
	const value = sections.get(key);
	if (value === undefined) {
		throw new DalMaraError(`Missing DMN section: ${key}`, ENGINE_ERROR_CODES.INVALID_ACTION);
	}
	return value;
}

function parseHandsSection(hValue: string): Record<string, Card[]> {
	const hands: Record<string, Card[]> = {};
	const isLegacy = hValue.includes("[P");
	const playerPattern = isLegacy ? /\[P(\d+):([^\]]*)\]/g : /P(\d+)\[([^\]]*)\]/g;
	let match: RegExpExecArray | null;

	match = playerPattern.exec(hValue);
	while (match !== null) {
		const position = match[1];
		const cardsStr = match[2] ?? "";
		const cards: Card[] = cardsStr ? (cardsStr.split(",").map((c) => c.trim()) as Card[]) : [];
		hands[`P${position}`] = cards;
		match = playerPattern.exec(hValue);
	}

	return hands;
}

function parseStacksSection(sValue: string): Record<string, PlayerStack2P[]> {
	if (!sValue || sValue === "-") return {};
	const result: Record<string, PlayerStack2P[]> = {};

	const playerRegex = /P(\d+)\[/g;
	let match = playerRegex.exec(sValue);

	while (match !== null) {
		const pPos = match[1];
		const startIdx = match.index + match[0].length;
		let depth = 1;
		let endIdx = startIdx;
		while (endIdx < sValue.length && depth > 0) {
			if (sValue[endIdx] === "[") depth++;
			else if (sValue[endIdx] === "]") depth--;
			endIdx++;
		}
		const pContent = sValue.slice(startIdx, endIdx - 1);

		const stackRegex = /S(\d+)\[([^|]*)\|([^\]]*)\]/g;
		const stacks: PlayerStack2P[] = [];
		let sMatch = stackRegex.exec(pContent);
		while (sMatch !== null) {
			const sPos = parseInt(sMatch[1], 10);
			const hiddenRaw = sMatch[2]?.trim() ?? "";
			const faceUpRaw = sMatch[3]?.trim() ?? "";
			const hiddenCards: Card[] = hiddenRaw ? (hiddenRaw.split(",").map((c) => c.trim()) as Card[]) : [];
			const faceUpCard: Card | null = faceUpRaw && faceUpRaw !== "-" ? (faceUpRaw as Card) : null;
			stacks.push({
				position: sPos,
				hiddenCards,
				faceUpCard,
			});
			sMatch = stackRegex.exec(pContent);
		}
		result[`P${pPos}`] = stacks;
		match = playerRegex.exec(sValue);
	}

	return result;
}

function parseTrickCardsArray(token: string): Card[] {
	const inner = token.slice(1, -1); // remove [ and ]
	if (!inner) return [];
	return inner.split(",").map((c) => c.trim()) as Card[];
}

export function importFromDMN(dmnString: string): Partial<GameState> & { dmn: DMNState } {
	const parts = dmnString.trim().split(/\s+/);

	if (parts.length < 6) {
		throw new DalMaraError(
			`Invalid DMN string: expected at least 6 space-separated parts, received ${parts.length}`,
			ENGINE_ERROR_CODES.INVALID_ACTION,
		);
	}

	const version = parts[0];
	if (version !== "DMN1") {
		throw new DalMaraError(`Unsupported DMN version: ${version}`, ENGINE_ERROR_CODES.INVALID_ACTION);
	}

	// Parse keyed sections
	const sections = new Map<string, string>();
	for (let i = 1; i < parts.length; i++) {
		const part = parts[i];
		const colonIdx = part.indexOf(":");
		if (colonIdx === -1) {
			throw new DalMaraError(`Invalid DMN section (missing colon): ${part}`, ENGINE_ERROR_CODES.INVALID_ACTION);
		}
		const key = part.slice(0, colonIdx);
		const value = part.slice(colonIdx + 1);
		sections.set(key, value);
	}

	// --- G section ---
	const gValue = parseSectionValue(sections, "G");
	const gParts = gValue.split(",");
	const mode: GameMode = gParts[0] === "2P" ? GAME_MODES.TWO_PLAYER : GAME_MODES.FOUR_PLAYER;
	const dealerPosition = parseInt(gParts[1] ?? "0", 10) as PlayerPosition;
	const trumpSuit = dmnToSuit(gParts[2] ?? "-");

	// --- H section ---
	const hValue = parseSectionValue(sections, "H");
	const handsRaw = parseHandsSection(hValue);

	// --- S section ---
	const sValue = sections.get("S") ?? "-";
	const stacksRaw = parseStacksSection(sValue);

	// --- M section ---
	const mValue = parseSectionValue(sections, "M");
	const mParts = mValue.split(",");
	const moveNumber = parseInt(mParts[0] ?? "0", 10);
	const trickNumber = parseInt(mParts[1] ?? "0", 10);
	const trickPlay = parseInt(mParts[2] ?? "0", 10);

	// --- T section ---
	const tValue = parseSectionValue(sections, "T");
	const tParts = tValue.split(",");
	const trickLeader = tParts[0] && tParts[0] !== "-" ? parseInt(tParts[0], 10) : null;
	const nextTrickLeader = tParts[1] && tParts[1] !== "-" ? parseInt(tParts[1], 10) : null;
	const isGhopteTrick = tParts[2] === "1";

	// --- C section ---
	const cValue = parseSectionValue(sections, "C");
	// Format: <PlayedCard>,<PlayedBy>,<IsGhopte>,<IsTurup>,[<TrickCards>]
	// Split at the first '[' to separate scalar fields from the trick cards array
	const bracketIdx = cValue.indexOf("[");
	let cFields: string[];
	let trickCardsRaw: Card[] = [];

	if (bracketIdx !== -1) {
		const beforeBracket = cValue.slice(0, bracketIdx);
		const trickCardsStr = cValue.slice(bracketIdx);
		cFields = beforeBracket.split(",").filter((s) => s !== "");
		trickCardsRaw = parseTrickCardsArray(trickCardsStr);
	} else {
		cFields = cValue.split(",");
	}

	const playedCardId: Card | null = cFields[0] && cFields[0] !== "-" ? (cFields[0] as Card) : null;
	const playedByPosition = cFields[1] && cFields[1] !== "-" ? parseInt(cFields[1], 10) : null;
	const isGhopteCard = cFields[2] === "1";
	const isTurup = cFields[3] === "1";

	// --- Construct players ---
	const numPlayers = mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;
	const players: Player[] = [];
	for (let i = 0; i < numPlayers; i++) {
		players.push({
			id: `p${i + 1}`,
			name: `Player ${i + 1}`,
			position: i as PlayerPosition,
			team: mode === GAME_MODES.FOUR_PLAYER ? (i % 2 === 0 ? "team1" : "team2") : `p${i + 1}`,
		});
	}

	// --- Hands directly use Card[] ---
	const hands: Record<string, readonly Card[]> = {};
	for (let i = 0; i < numPlayers; i++) {
		const playerId = `p${i + 1}`;
		hands[playerId] = handsRaw[`P${i}`] ?? [];
	}

	// --- Stacks directly use PlayerStack2P[] ---
	const stacks2P: Record<string, readonly PlayerStack2P[]> = {};
	if (mode === GAME_MODES.TWO_PLAYER) {
		for (let i = 0; i < numPlayers; i++) {
			const playerId = `p${i + 1}`;
			stacks2P[playerId] = stacksRaw[`P${i}`] ?? [];
		}
	}

	const currentTurnPlayerId = nextTrickLeader !== null ? (players[nextTrickLeader]?.id ?? null) : null;

	// --- Determine phase ---
	let phase: GamePhase = GAME_PHASES.PLAYING;
	if (isGhopteTrick) {
		phase = GAME_PHASES.GHOPTE;
	} else if (moveNumber === 0 && trickNumber === 0) {
		const totalCards = Object.values(hands).reduce((sum, h) => sum + h.length, 0);
		phase = totalCards > 0 ? GAME_PHASES.PLAYING : GAME_PHASES.DEAL;
	}

	// --- Build current trick from C section's trick cards ---
	const trickCardObjects: PlayedCard[] = trickCardsRaw.map((card, idx) => {
		// Determine who played each card: trick leader starts, then anti-clockwise
		let playerId: string;
		if (trickLeader !== null) {
			const pos = (trickLeader + idx) % numPlayers;
			playerId = players[pos]?.id ?? `p${pos + 1}`;
		} else {
			playerId = `p${idx + 1}`;
		}
		return { playerId, card, playOrder: idx + 1 };
	});

	const leadSuit = trickCardObjects.length > 0 ? parseCard(trickCardObjects[0].card).suit : null;

	const currentTrick: Trick = {
		trickNumber: trickNumber > 0 ? trickNumber : 1,
		leadSuit,
		cards: trickCardObjects,
		winnerId: null,
	};

	// --- Build DMNState ---
	const dmn: DMNState = {
		version,
		mode,
		dealerPosition,
		trumpSuit,
		hands: handsRaw,
		stacks2P: mode === GAME_MODES.TWO_PLAYER ? stacks2P : null,
		moveNumber,
		trickNumber,
		trickPlay,
		trickLeader,
		nextTrickLeader,
		isGhopteTrick,
		playedCard: playedCardId,
		playedBy: playedByPosition,
		isGhopteCard,
		isTurup,
		trickCards: trickCardsRaw,
	};

	return {
		mode,
		phase,
		dealerPosition,
		currentTurnPlayerId,
		players,
		hands,
		stacks2P,
		currentTrick,
		currentTurup: trumpSuit,
		roundNumber: trickNumber > 0 ? trickNumber : 1,
		dmn,
	};
}

// ---------------------------------------------------------------------------
// Full Game reconstruction from DMN
// ---------------------------------------------------------------------------

export function fromDMN(dmnString: string): Game | ValidationResult {
	const partialState = importFromDMN(dmnString);

	const mode = partialState.mode ?? GAME_MODES.FOUR_PLAYER;
	const players = partialState.players ?? [];
	const dealerPosition = (partialState.dealerPosition ?? partialState.dmn?.dealerPosition ?? 0) as PlayerPosition;

	const fullState: GameState = {
		id: partialState.id ?? "game-dmn",
		mode,
		phase: partialState.phase ?? GAME_PHASES.PLAYING,
		players,
		dealerPosition,
		currentTurnPlayerId: partialState.currentTurnPlayerId ?? null,
		hands: partialState.hands ?? {},
		stacks2P: partialState.stacks2P ?? {},
		currentTrick: partialState.currentTrick ?? {
			trickNumber: 1,
			leadSuit: null,
			cards: [],
			winnerId: null,
		},
		currentTurup: partialState.currentTurup ?? null,
		ghopteState: null,
		scores: partialState.scores ?? {},
		trickHistory: [],
		roundNumber: partialState.roundNumber ?? 1,
		winnerTeam: null,
		actionHistory: [],
	};

	return Game.create(fullState);
}
