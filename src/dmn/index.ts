import {
	ABBREVIATION_TO_SUIT,
	SUIT_ABBREVIATION,
	createCard,
	type SuitAbbreviation,
} from "../cards/deck";
import {
	DalMaraError,
	type Card,
	type GameMode,
	type GamePhase,
	type GameState,
	type PlayedCard,
	type Player,
	type PlayerStack2P,
	type ScoreState,
	type Suit,
	type Trick,
} from "../types/index";
import { GAME_MODES, GAME_PHASES, TEAMS } from "../types/index";

/**
 * Dal Mara Notation (DMN) - FEN equivalent for Dal Mara.
 * Format: <Version>/<Mode>/<Phase>/D:<Dealer>,T:<Turn>/<TurupState>/<Hands>/<Stacks2P>/<CurrentTrick>/<Scores>
 */

export function cardToDMN(card: Card): string {
	return `${card.rank}${SUIT_ABBREVIATION[card.suit]}`;
}

export function dmnToCard(str: string): Card | null {
	if (!str || str === "_") return null;
	const suitAbbr = str.slice(-1) as SuitAbbreviation;
	const rankStr = str.slice(0, -1);
	const suit = ABBREVIATION_TO_SUIT[suitAbbr];
	if (!suit) return null;
	return createCard(suit, rankStr as any);
}

export function exportToDMN(state: GameState): string {
	const version = "v1";
	const mode = state.mode;
	const phase = state.phase;

	// Dealer & Turn
	const dealerStr = `D:${state.dealerIndex}`;
	const turnIndex = state.currentTurnPlayerId
		? state.players.findIndex((p) => p.id === state.currentTurnPlayerId)
		: -1;
	const turnStr = `T:${turnIndex >= 0 ? turnIndex : "-"}`;

	// Turup state
	let turupStr = "TR:NONE";
	if (state.currentTurup) {
		const activeAbbr = SUIT_ABBREVIATION[state.currentTurup];
		turupStr = `TR:${activeAbbr}`;
	}

	// Hands
	const handsArr: string[] = [];
	state.players.forEach((p, idx) => {
		const hand = state.hands[p.id] ?? [];
		const cardStrs = hand.map(cardToDMN).join(",");
		handsArr.push(`P${idx}:${cardStrs || "_"}`);
	});
	const handsStr = handsArr.join("|");

	// Stacks 2P
	let stacksStr = "-";
	if (state.mode === GAME_MODES.TWO_PLAYER) {
		const stacksArr: string[] = [];
		state.players.forEach((p, idx) => {
			const playerStacks = state.stacks2P[p.id] ?? [];
			const stackStrs = playerStacks.map((st) => {
				const hiddenStrs = st.hiddenCards.map(cardToDMN).join(",");
				const faceUpStr = st.faceUpCard ? cardToDMN(st.faceUpCard) : "";
				if (hiddenStrs && faceUpStr) return `${hiddenStrs}^${faceUpStr}`;
				if (faceUpStr) return `${faceUpStr}`;
				if (hiddenStrs) return `${hiddenStrs}^`;
				return "_";
			});
			stacksArr.push(`P${idx}:${stackStrs.join(",")}`);
		});
		stacksStr = stacksArr.join("|");
	}

	// Current Trick
	const leadSuitStr = state.currentTrick.leadSuit
		? SUIT_ABBREVIATION[state.currentTrick.leadSuit]
		: "-";
	const playedCardsStr =
		state.currentTrick.cards.length > 0
			? state.currentTrick.cards
					.map((pc) => {
						const pIdx = state.players.findIndex((p) => p.id === pc.playerId);
						return `${pIdx}:${cardToDMN(pc.card)}`;
					})
					.join(",")
			: "-";
	const trickStr = `L:${leadSuitStr},C:${playedCardsStr}`;

	// Scores
	const scoresArr: string[] = [];
	state.players.forEach((p, idx) => {
		const sc = state.scores[p.id] ?? { capturedTens: 0, capturedTricks: 0 };
		scoresArr.push(
			`P${idx}:tens=${sc.capturedTens},tricks=${sc.capturedTricks}`,
		);
	});
	const scoreStr = scoresArr.join("|");

	return `${version}/${mode}/${phase}/${dealerStr},${turnStr}/${turupStr}/${handsStr}/${stacksStr}/${trickStr}/${scoreStr}`;
}

export function importFromDMN(dmnString: string): Partial<GameState> {
	if (!dmnString) {
		throw new DalMaraError("Invalid DMN format: empty string", "INVALID_DMN");
	}

	// Strip optional DMN: prefix if present
	const content = dmnString.startsWith("DMN:") ? dmnString.slice(4) : dmnString;
	const parts = content.split("/");
	if (parts.length < 9) {
		throw new DalMaraError(
			`Invalid DMN format: expected at least 9 slash-separated components, got ${parts.length}`,
			"INVALID_DMN",
		);
	}

	const [
		_version,
		modeStr,
		phaseStr,
		dealerTurnStr,
		turupStr,
		handsStr,
		stacksStr,
		trickStr,
		scoresStr,
	] = parts;

	const mode: GameMode =
		modeStr === "2P" ? GAME_MODES.TWO_PLAYER : GAME_MODES.FOUR_PLAYER;
	const phase = (phaseStr as GamePhase) ?? GAME_PHASES.PLAYING;

	// Dealer & Turn
	const dealerMatch = dealerTurnStr
		? dealerTurnStr.match(/D:(\d+),T:(.+)/)
		: null;
	const dealerIndexStr = dealerMatch ? dealerMatch[1] : null;
	const dealerIndex = dealerIndexStr ? parseInt(dealerIndexStr, 10) : 0;
	const turnIndexStr = dealerMatch ? (dealerMatch[2] ?? "-") : "-";

	// Turup
	let currentTurup: Suit | null = null;
	if (turupStr && turupStr !== "TR:NONE") {
		const match = turupStr.match(/TR:([shdc])/);
		if (match) {
			const primaryAbbr = match[1] as SuitAbbreviation | undefined;
			if (primaryAbbr && primaryAbbr in ABBREVIATION_TO_SUIT) {
				currentTurup = ABBREVIATION_TO_SUIT[primaryAbbr] ?? null;
			}
		}
	}

	// Players setup (p1, p2, p3, p4)
	const numPlayers = mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;
	const players: Player[] = [];
	for (let i = 0; i < numPlayers; i++) {
		players.push({
			id: `p${i + 1}`,
			name: `Player ${i + 1}`,
			position: i,
			teamId:
				mode === GAME_MODES.FOUR_PLAYER
					? i % 2 === 0
						? TEAMS.TEAM_1
						: TEAMS.TEAM_2
					: `p${i + 1}`,
		});
	}

	const dealerId = players[dealerIndex]?.id ?? players[0]?.id ?? "p1";
	const currentTurnPlayerId =
		turnIndexStr !== "-"
			? (players[parseInt(turnIndexStr, 10)]?.id ?? null)
			: null;

	// Hands
	const hands: Record<string, Card[]> = {};
	if (handsStr) {
		const playerHandTokens = handsStr.split("|");
		playerHandTokens.forEach((token) => {
			const [pTag, cardsPart] = token.split(":");
			if (pTag && cardsPart) {
				const pIdx = parseInt(pTag.replace("P", ""), 10);
				const pId = players[pIdx]?.id;
				if (pId) {
					if (cardsPart === "_") {
						hands[pId] = [];
					} else {
						hands[pId] = cardsPart
							.split(",")
							.map(dmnToCard)
							.filter((c): c is Card => c !== null);
					}
				}
			}
		});
	}

	// Stacks 2P
	const stacks2P: Record<string, PlayerStack2P[]> = {};
	if (mode === GAME_MODES.TWO_PLAYER && stacksStr && stacksStr !== "-") {
		const playerStackTokens = stacksStr.split("|");
		playerStackTokens.forEach((token) => {
			const [pTag, stacksPart] = token.split(":");
			if (pTag && stacksPart) {
				const pIdx = parseInt(pTag.replace("P", ""), 10);
				const pId = players[pIdx]?.id;
				if (pId) {
					const stackTokens = stacksPart.split(",");
					stacks2P[pId] = stackTokens.map((stStr, sIdx) => {
						if (stStr === "_")
							return {
								id: `stack-${sIdx}`,
								position: sIdx,
								hiddenCards: [],
								faceUpCard: null,
							};
						if (stStr.includes("^")) {
							const [hiddenPart, faceUpPart] = stStr.split("^");
							const hiddenCards = hiddenPart
								? hiddenPart
										.split(",")
										.map(dmnToCard)
										.filter((c): c is Card => c !== null)
								: [];
							const faceUpCard = faceUpPart ? dmnToCard(faceUpPart) : null;
							return {
								id: `stack-${sIdx}`,
								position: sIdx,
								hiddenCards,
								faceUpCard,
							};
						}
						const card = dmnToCard(stStr);
						return {
							id: `stack-${sIdx}`,
							position: sIdx,
							hiddenCards: [],
							faceUpCard: card,
						};
					});
				}
			}
		});
	}

	// Current Trick
	const trickMatch = trickStr ? trickStr.match(/L:([shdc]|-),C:(.+)/) : null;
	const leadSuitAbbr = trickMatch
		? (trickMatch[1] as SuitAbbreviation | "-")
		: "-";
	const leadSuit =
		leadSuitAbbr && leadSuitAbbr !== "-" && leadSuitAbbr in ABBREVIATION_TO_SUIT
			? (ABBREVIATION_TO_SUIT[leadSuitAbbr as SuitAbbreviation] ?? null)
			: null;
	const cardsPlayedStr = trickMatch ? (trickMatch[2] ?? "-") : "-";

	const playedCards: PlayedCard[] = [];
	if (cardsPlayedStr !== "-") {
		cardsPlayedStr.split(",").forEach((item) => {
			const [pIdxStr, cardStr] = item.split(":");
			if (pIdxStr && cardStr) {
				const pIdx = parseInt(pIdxStr, 10);
				const pId = players[pIdx]?.id;
				const card = dmnToCard(cardStr);
				if (pId && card) {
					playedCards.push({ playerId: pId, card });
				}
			}
		});
	}

	const currentTrick: Trick = {
		leadSuit,
		cards: playedCards,
		winnerId: null,
	};

	// Scores
	const scores: Record<string, ScoreState> = {};
	if (scoresStr) {
		scoresStr.split("|").forEach((item) => {
			const [tag, detail] = item.split(":");
			if (tag && detail) {
				const tensMatch = detail.match(/tens=(\d+)/);
				const tricksMatch = detail.match(/tricks=(\d+)/);
				const tensStr = tensMatch ? tensMatch[1] : null;
				const tricksStr = tricksMatch ? tricksMatch[1] : null;
				const capturedTens = tensStr ? parseInt(tensStr, 10) : 0;
				const capturedTricks = tricksStr ? parseInt(tricksStr, 10) : 0;

				const scoreObj: ScoreState = {
					capturedTens,
					capturedTricks,
					capturedCards: [],
					capturedTrickRecords: [],
				};

				if (tag.startsWith("P")) {
					const pIdx = parseInt(tag.replace("P", ""), 10);
					const pId = players[pIdx]?.id;
					if (pId) scores[pId] = scoreObj;
				}
			}
		});
	}

	return {
		mode,
		phase,
		dealerId,
		dealerIndex,
		currentTurnPlayerId,
		players,
		hands,
		stacks2P,
		currentTurup,
		currentTrick,
		scores,
	};
}
