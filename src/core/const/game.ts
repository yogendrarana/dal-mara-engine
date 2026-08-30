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

// Ghopte resolution order:
// "daler last is the default value"
export const GHOPTE_RESOLUTION_ORDER = {
	DEALER_FIRST: "dealer_first",
	DEALER_LAST: "dealer_last",
} as const;
