import { createCard } from "./card";

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
	ValidationResult,
} from "../types/index";

import { ABBREVIATION_TO_SUIT, ENGINE_ERROR_CODES, GAME_MODES, GAME_PHASES, SUIT_ABBREVIATION } from "./const";
import { DalMaraError } from "./errors";
import { Game } from "./game";

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

export function cardToDMN(card: Card | null): string {
	if (!card) return "-";
	const suitAbbr = SUIT_ABBREVIATION[card.suit];
	return `${card.rank}${suitAbbr}`;
}

export function dmnToCard(token: string): Card | null {
	if (!token || token === "-") return null;

	const suitChar = token.slice(-1).toLowerCase() as SuitAbbreviation;
	const rankStr = token.slice(0, -1);

	const suit = ABBREVIATION_TO_SUIT[suitChar];
	if (!suit) {
		throw new DalMaraError(`Invalid suit character in DMN token: ${token}`, ENGINE_ERROR_CODES.INVALID_ACTION);
	}

	const rank = rankStr;
	return createCard(suit, rank as Card["rank"]);
}

export function exportToDMN(state: GameState): string {
	const version = "DMN1";
	const modeToken = state.mode === GAME_MODES.FOUR_PLAYER ? "4" : "2";

	// Find dealer position
	const dealerIndex = state.players.findIndex((p) => p.id === state.dealerId);
	const dealerPositionToken = dealerIndex >= 0 ? String(dealerIndex) : "0";

	// Trick number (0 if before trick play e.g. Ghopte/Deal)
	let trickNumberToken = "0";
	let trickPlayToken = "0";
	let trickLeaderToken = "-";
	let nextTrickLeaderToken = "-";
	let playedByToken = "-";
	let isGhopteToken = "-";
	let isTurupToken = "-";
	let cardPlayedToken = "-";

	if (state.phase === GAME_PHASES.GHOPTE) {
		trickNumberToken = "0";
		isGhopteToken = "1";
		isTurupToken = "0";

		if (state.ghopteState) {
			const submittedCount = state.ghopteState.ghoptes.length;
			trickPlayToken = String(submittedCount);
		}

		if (state.currentTurnPlayerId) {
			const turnPlayer = state.players.find((p) => p.id === state.currentTurnPlayerId);
			if (turnPlayer) {
				nextTrickLeaderToken = String(turnPlayer.position);
			}
		}
	} else {
		// Playing phase or End phase
		trickNumberToken = String(state.currentTrick?.trickNumber ?? 1);
		isGhopteToken = "0";

		const currentTrickCards = state.currentTrick?.cards ?? [];
		trickPlayToken = String(currentTrickCards.length);

		// Current trick leader
		if (state.currentTrick && currentTrickCards.length > 0) {
			const leaderPlayer = state.players.find((p) => p.id === currentTrickCards[0]?.playerId);
			if (leaderPlayer) {
				trickLeaderToken = String(leaderPlayer.position);
			}
		}

		// Turn player / Next leader
		if (state.currentTurnPlayerId) {
			const turnPlayer = state.players.find((p) => p.id === state.currentTurnPlayerId);
			if (turnPlayer) {
				nextTrickLeaderToken = String(turnPlayer.position);
			}
		}

		// Last played card in the trick
		if (currentTrickCards.length > 0) {
			const lastPlay = currentTrickCards[currentTrickCards.length - 1];
			if (lastPlay) {
				const player = state.players.find((p) => p.id === lastPlay.playerId);
				if (player) {
					playedByToken = String(player.position);
				}
				cardPlayedToken = cardToDMN(lastPlay.card);
				isTurupToken = state.currentTurup === lastPlay.card.suit ? "1" : "0";
			}
		}
	}

	return [
		version,
		modeToken,
		dealerPositionToken,
		trickNumberToken,
		trickPlayToken,
		trickLeaderToken,
		nextTrickLeaderToken,
		playedByToken,
		isGhopteToken,
		isTurupToken,
		cardPlayedToken,
	].join(" ");
}

export function toDMN(stateOrGame: GameState | Game): string {
	if ("state" in stateOrGame && stateOrGame.state) {
		return exportToDMN(stateOrGame.state);
	}
	return exportToDMN(stateOrGame as GameState);
}

export function importFromDMN(dmnString: string): Partial<GameState> & { dmn: DMNState } {
	const tokens = dmnString.trim().split(/\s+/);
	if (tokens.length < 11) {
		throw new DalMaraError(
			`Invalid DMN string: expected at least 11 tokens, received ${tokens.length}`,
			ENGINE_ERROR_CODES.INVALID_ACTION,
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

export function fromDMN(dmnString: string): Game | ValidationResult {
	const partialState = importFromDMN(dmnString);

	const mode = partialState.mode ?? GAME_MODES.FOUR_PLAYER;
	const players = partialState.players ?? [];
	const dealerId = partialState.dealerId ?? "p1";

	const fullState: GameState = {
		id: partialState.id ?? "game-dmn",
		mode,
		phase: partialState.phase ?? GAME_PHASES.PLAYING,
		settings: { mode },
		players,
		dealerId,
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
