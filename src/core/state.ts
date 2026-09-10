import { GAME_MODES, GAME_PHASES } from "./const";
import type { Card, GameMode, GameState, Player, Seat, PlayerStack } from "../types/index";

export function createInitialState(options: { mode: GameMode; players: readonly Player[]; dealerSeat: Seat }): GameState {
	const { mode, players, dealerSeat } = options;

	const orderedPlayers: Player[] = [...players]
		.sort((a, b) => a.seat - b.seat)
		.map((p) => ({
			seat: p.seat,
			team: p.team ?? (mode === GAME_MODES.FOUR_PLAYER ? (p.seat % 2 === 0 ? "02" : "13") : String(p.seat)),
		}));

	return {
		game: {
			mode,
			dealerSeat,
			turup: null,
			phase: GAME_PHASES.DEAL,
		},
		players: orderedPlayers,
		hands: {} as Record<Seat, readonly Card[]>,
		stacks: {} as Record<Seat, readonly PlayerStack[]>,
		ghoptes: [],
		moveNumber: 0,
		trick: {
			number: 1,
			playNumber: 0,
			leadSuit: null,
			isGhopte: false,
			cards: [],
		},
		moveDetail: {
			seat: null,
			card: null,
			makesTurup: false,
		},
		nextMoveSeat: dealerSeat,
	};
}
