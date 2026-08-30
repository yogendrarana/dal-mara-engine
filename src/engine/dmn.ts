import { createCard } from "../core/deck";

import type {
	Card,
	GameMode,
	GamePhase,
	GameState,
	PlayedCard,
	Player,
	PlayerPosition,
	SuitAbbreviation,
	Trick,
} from "../types/index";

import { ABBREVIATION_TO_SUIT, ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES, SUIT_ABBREVIATION } from "../core/const";
import { DalMaraError } from "../core/errors";

// Proposed new format:
// Dal Mara Notation (DMN)
//
// Format:
// DMN1 <Mode> <DealerPosition> <Trick> <TrickPlay> <TrickLeaderPosition> <NextTrickLeaderPosition> <PlayedBy> <IsGhopte> <IsTurup> <CardPlayed>

// Rules:
// - No hands stored
// - No score stored
// - "-" represents no value / not applicable
// - Values are separated by a single space
// - DMN1 is the notation version

// Fields:
// DMN1 (notation version)
// Mode (2 or 4 players)
// DealerPosition (one of 0, 1, 2, 3)
// Trick (0 for the initial/Ghopte state, 1-13 during normal play)
// TrickPlay (0 for initial state; position of the play within the trick i.e. 1-4)
// TrickLeaderPosition (one of 0, 1, 2, 3)
// NextTrickLeaderPosition (one of 0, 1, 2, 3)
// PlayedBy (one of 0, 1, 2, 3)
// IsGhopte (0 or 1)
// IsTurup  (0 or 1)
// CardPlayed

// Example:
// DMN1 4 2 0 0 - 1 - - - - (initial phase)
// DMN1 4 2 0 2 - 3 3 1 0 7H (ghopte phase)

// DMN1    version
// 4       mode
// 2       dealer position
// 7       trick number
// 3       play within trick
// 1       current trick leader
// -       next trick leader
// 3       player who played
// 0       not Ghopte
// 1       Turup
// 10S     card played

export interface DMNState {
	readonly version: string;
	readonly mode: GameMode;
	readonly dealerPosition: number;
	readonly trick: number;
	readonly trickPlay: number;
	readonly trickLeaderPosition: number | null;
	readonly nextTrickLeaderPosition: number | null;
	readonly playedBy: number | null;
	readonly isGhopte: boolean | null;
	readonly isTurup: boolean | null;
	readonly cardPlayed: Card | null;
}

export function cardToDMN(card: Card): string {
	return `${card.rank}${SUIT_ABBREVIATION[card.suit].toUpperCase()}`;
}

export function dmnToCard(str: string): Card | null {
	if (!str || str === "-" || str === "_") return null;
	const suitAbbr = str.slice(-1).toLowerCase() as SuitAbbreviation;
	const rankStr = str.slice(0, -1);
	const suit = ABBREVIATION_TO_SUIT[suitAbbr];
	if (!suit) return null;
	return createCard(suit, rankStr as any);
}

export function exportToDMN(state: GameState): string {
	const version = "DMN1";
	const mode = state.mode === GAME_MODES.TWO_PLAYER ? "2" : "4";

	// Dealer position
	let dealerPosition = state.players.findIndex((p) => p.id === state.dealerId);
	if (dealerPosition < 0) {
		dealerPosition = 0;
	}

	// Trick number (0 for initial/Ghopte, 1-13 for normal)
	let trick = 0;
	if (state.phase === GAME_PHASES.PLAYING || state.phase === GAME_PHASES.END) {
		trick = state.roundNumber;
	}

	// TrickPlay (0 if no cards played in current trick, or 1-4)
	const trickPlay = state.currentTrick.cards.length;

	// TrickLeaderPosition (position of player who played first card in trick)
	let trickLeaderStr = "-";
	if (state.currentTrick.cards.length > 0) {
		const leadCard = state.currentTrick.cards[0];
		if (leadCard) {
			const leadPlayer = state.players.find((p) => p.id === leadCard.playerId);
			if (leadPlayer) {
				trickLeaderStr = String(leadPlayer.position);
			}
		}
	}

	// NextTrickLeaderPosition (winner or next turn player)
	let nextTrickLeaderStr = "-";
	if (state.currentTrick.winnerId) {
		const winner = state.players.find((p) => p.id === state.currentTrick.winnerId);
		if (winner) {
			nextTrickLeaderStr = String(winner.position);
		}
	} else if (state.currentTurnPlayerId) {
		const turnPlayer = state.players.find((p) => p.id === state.currentTurnPlayerId);
		if (turnPlayer) {
			nextTrickLeaderStr = String(turnPlayer.position);
		}
	}

	// PlayedBy (position of player who played the latest card)
	let playedByStr = "-";
	let cardPlayedStr = "-";
	let isTurupStr = "-";

	if (state.currentTrick.cards.length > 0) {
		const lastPlayed = state.currentTrick.cards[state.currentTrick.cards.length - 1];
		if (lastPlayed) {
			const player = state.players.find((p) => p.id === lastPlayed.playerId);
			if (player) {
				playedByStr = String(player.position);
			}
			cardPlayedStr = cardToDMN(lastPlayed.card);
			isTurupStr = state.currentTurup && lastPlayed.card.suit === state.currentTurup ? "1" : "0";
		}
	}

	// IsGhopte
	let isGhopteStr = "-";
	if (state.phase === GAME_PHASES.GHOPTE) {
		isGhopteStr = "1";
	} else if (state.phase === GAME_PHASES.PLAYING || state.phase === GAME_PHASES.END) {
		isGhopteStr = "0";
	}

	return `${version} ${mode} ${dealerPosition} ${trick} ${trickPlay} ${trickLeaderStr} ${nextTrickLeaderStr} ${playedByStr} ${isGhopteStr} ${isTurupStr} ${cardPlayedStr}`;
}

export function importFromDMN(dmnString: string): Partial<GameState> & { dmn: DMNState } {
	if (!dmnString || typeof dmnString !== "string") {
		throw new DalMaraError("Invalid DMN format: empty string", ENGINE_ERROR_CODES.INVALID_DMN);
	}

	const tokens = dmnString.trim().split(/\s+/);
	if (tokens.length < 11 || tokens[0] !== "DMN1") {
		throw new DalMaraError(
			`Invalid DMN format: expected 11 space-separated tokens starting with DMN1, got '${dmnString}'`,
			ENGINE_ERROR_CODES.INVALID_DMN,
		);
	}

	const [
		version,
		modeToken,
		dealerPosToken,
		trickToken,
		trickPlayToken,
		trickLeaderToken,
		nextTrickLeaderToken,
		playedByToken,
		isGhopteToken,
		isTurupToken,
		cardPlayedToken,
	] = tokens;

	const mode: GameMode = modeToken === "2" ? GAME_MODES.TWO_PLAYER : GAME_MODES.FOUR_PLAYER;
	const numPlayers = mode === GAME_MODES.FOUR_PLAYER ? 4 : 2;

	const dealerPosition = parseInt(dealerPosToken ?? "0", 10);
	const trick = parseInt(trickToken ?? "0", 10);
	const trickPlay = parseInt(trickPlayToken ?? "0", 10);
	const trickLeaderPosition = trickLeaderToken && trickLeaderToken !== "-" ? parseInt(trickLeaderToken, 10) : null;
	const nextTrickLeaderPosition =
		nextTrickLeaderToken && nextTrickLeaderToken !== "-" ? parseInt(nextTrickLeaderToken, 10) : null;
	const playedBy = playedByToken && playedByToken !== "-" ? parseInt(playedByToken, 10) : null;
	const isGhopte = isGhopteToken === "1" ? true : isGhopteToken === "0" ? false : null;
	const isTurup = isTurupToken === "1" ? true : isTurupToken === "0" ? false : null;
	const cardPlayed = dmnToCard(cardPlayedToken ?? "-");

	// Construct players
	const players: Player[] = [];
	for (let i = 0; i < numPlayers; i++) {
		players.push({
			id: `p${i + 1}`,
			name: `Player ${i + 1}`,
			position: i as PlayerPosition,
			team: mode === GAME_MODES.FOUR_PLAYER ? (i % 2 === 0 ? "team1" : "team2") : `p${i + 1}`,
		});
	}

	const dealerId = players[dealerPosition]?.id ?? players[0]?.id ?? "p1";
	const currentTurnPlayerId = nextTrickLeaderPosition !== null ? (players[nextTrickLeaderPosition]?.id ?? null) : null;

	let phase: GamePhase = GAME_PHASES.PLAYING;
	if (isGhopte) {
		phase = GAME_PHASES.GHOPTE;
	} else if (trick === 0) {
		phase = GAME_PHASES.DEAL;
	}

	const playedCards: PlayedCard[] = [];
	if (cardPlayed && playedBy !== null) {
		const playerId = players[playedBy]?.id;
		if (playerId) {
			playedCards.push({ playerId, card: cardPlayed, playOrder: playedCards.length + 1 });
		}
	}

	const currentTrick: Trick = {
		trickNumber: trick > 0 ? trick : 1,
		leadSuit: cardPlayed ? cardPlayed.suit : null,
		cards: playedCards,
		winnerId: null,
	};

	const dmnState: DMNState = {
		version: version ?? "DMN1",
		mode,
		dealerPosition,
		trick,
		trickPlay,
		trickLeaderPosition,
		nextTrickLeaderPosition,
		playedBy,
		isGhopte,
		isTurup,
		cardPlayed,
	};

	return {
		mode,
		phase,
		dealerId,
		currentTurnPlayerId,
		players,
		roundNumber: trick > 0 ? trick : 1,
		currentTrick,
		dmn: dmnState,
	};
}
