export const GAME_MODES = {
	FOUR_PLAYER: "4P",
	TWO_PLAYER: "2P",
} as const;

export const GAME_PHASES = {
	DEAL: "DEAL",
	TURUP_DECLARATION: "TURUP_DECLARATION", // 2P mode only
	GHOPTE: "GHOPTE", // 4P mode only
	PLAYING: "PLAYING",
	END: "END",
} as const;
