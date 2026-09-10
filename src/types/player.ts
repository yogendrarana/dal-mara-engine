// 0 to 3 for 4P, 0 to 1 for 2P
export type Seat = 0 | 1 | 2 | 3;

export interface Player {
	readonly seat: Seat;
	readonly team?: string;
}
