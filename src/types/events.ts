// events
export type GameEventType =
	| "GameCreated"
	| "CardsDealt"
	| "TurupDeclared"
	| "TurupCreated"
	| "TurupChanged"
	| "TurnStarted"
	| "CardPlayed"
	| "GhopteStarted"
	| "GhopteCardSubmitted"
	| "GhopteResolved"
	| "TrickWon"
	| "TenCaptured"
	| "RoundFinished"
	| "GameFinished";

export interface GameEvent {
	readonly type: GameEventType;
	readonly payload: Record<string, unknown>;
	readonly timestamp: number;
}
