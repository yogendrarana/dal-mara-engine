import { DalMaraError, type GameState } from "../types/index";

export interface SerializedGameData {
	readonly version: string;
	readonly engineVersion: string;
	readonly state: GameState;
}

export function serializeState(state: GameState): string {
	const data: SerializedGameData = {
		version: "1.0",
		engineVersion: "0.1.0",
		state,
	};
	return JSON.stringify(data, null, 2);
}

export function deserializeState(json: string): GameState {
	try {
		const parsed = JSON.parse(json) as SerializedGameData;
		if (!parsed?.state) {
			throw new DalMaraError(
				"Invalid serialized game state JSON: missing 'state' field",
				"INVALID_SERIALIZATION",
			);
		}
		return parsed.state;
	} catch (e) {
		if (e instanceof DalMaraError) {
			throw e;
		}
		throw new DalMaraError(
			`Failed to deserialize game state: ${e instanceof Error ? e.message : String(e)}`,
			"INVALID_SERIALIZATION",
		);
	}
}
