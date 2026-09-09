// 0 to 3 for 4P, 0 to 1 for 2P
export type PlayerPosition = 0 | 1 | 2 | 3;

export interface Player {
	readonly position: PlayerPosition;
	readonly team?: string;
}
