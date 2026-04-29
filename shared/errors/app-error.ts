import { ERRORS, type ErrorCode } from "./codes.js";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, details?: Record<string, unknown>) {
    super(ERRORS[code].message);
    this.name = "AppError";
    this.code = code;
    this.status = ERRORS[code].status;
    this.details = details;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

interface ErrorResult {
  error: string;
}

export function throwIfError<T>(result: T | ErrorResult): asserts result is T {
  if (result && typeof result === "object" && "error" in result) {
    const code = (result as ErrorResult).error;
    const validCode =
      code in ERRORS ? (code as ErrorCode) : ("INTERNAL_ERROR" as ErrorCode);
    throw new AppError(validCode);
  }
}
