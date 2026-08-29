import type { GameEvent, GameEventType } from "../types/index";

export type EventListener = (event: GameEvent) => void;

export class EventDispatcher {
	private globalListeners: Set<EventListener> = new Set();
	private listeners: Map<GameEventType, Set<EventListener>> = new Map();

	public on(eventType: GameEventType, listener: EventListener): () => void {
		if (!this.listeners.has(eventType)) {
			this.listeners.set(eventType, new Set());
		}

		const set = this.listeners.get(eventType);
		if (set) {
			set.add(listener);
		}

		return () => {
			this.off(eventType, listener);
		};
	}

	public onAny(listener: EventListener): () => void {
		this.globalListeners.add(listener);
		return () => {
			this.globalListeners.delete(listener);
		};
	}

	public off(eventType: GameEventType, listener: EventListener): void {
		const set = this.listeners.get(eventType);
		if (set) {
			set.delete(listener);
		}
	}

	public emit(eventType: GameEventType, payload: Record<string, unknown> = {}): void {
		const event: GameEvent = {
			type: eventType,
			payload: Object.freeze(payload),
			timestamp: Date.now(),
		};

		const set = this.listeners.get(eventType);
		if (set) {
			for (const listener of set) {
				try {
					listener(event);
				} catch (e) {
					console.error(`Error in event listener for ${eventType}:`, e);
				}
			}
		}

		for (const listener of this.globalListeners) {
			try {
				listener(event);
			} catch (e) {
				console.error("Error in global event listener:", e);
			}
		}
	}

	public clear(): void {
		this.listeners.clear();
		this.globalListeners.clear();
	}
}
