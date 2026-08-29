import type { EngineError, ValidationResult } from "../types";

// custom error class for Dal Mara engine runtime and deserialization errors.
export class DalMaraError extends Error {
	public readonly code?: string;
	public readonly details?: Record<string, unknown>;

	constructor(message: string, code?: string, details?: Record<string, unknown>) {
		super(message);
		this.name = "DalMaraError";
		this.code = code;
		this.details = details;
		Object.setPrototypeOf(this, DalMaraError.prototype);
	}
}

// create error helper
export function createValidationError(
	code: EngineError["code"],
	message: string,
	details?: Record<string, unknown>,
): ValidationResult {
	return {
		success: false,
		error: details ? { code, message, details } : { code, message },
	};
}
