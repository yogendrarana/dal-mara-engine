import type { ENGINE_ERROR_CODES } from "../core/const";

export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[keyof typeof ENGINE_ERROR_CODES];

export interface EngineError {
	readonly code: EngineErrorCode;
	readonly message: string;
	readonly details?: Record<string, unknown>;
}

export type ValidationResult = { readonly success: true } | { readonly success: false; readonly error: EngineError };
