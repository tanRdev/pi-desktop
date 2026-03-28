import { Data, Effect } from "effect";

// Base error class for PiDesk errors
export class PiDeskError extends Data.TaggedError("PiDeskError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {
  override toString() {
    return `PiDeskError: ${this.message}${this.cause ? ` (caused by: ${this.cause})` : ""}`;
  }
}

// Repository-related errors
export class RepositoryError extends Data.TaggedError("RepositoryError")<{
  readonly message: string;
  readonly repositoryId?: string;
  readonly cause?: unknown;
}> {}

// Thread-related errors
export class ThreadError extends Data.TaggedError("ThreadError")<{
  readonly message: string;
  readonly threadId?: string;
  readonly cause?: unknown;
}> {}

// File system errors
export class FileSystemError extends Data.TaggedError("FileSystemError")<{
  readonly message: string;
  readonly path?: string;
  readonly cause?: unknown;
}> {}

// IPC/Communication errors
export class IPCError extends Data.TaggedError("IPCError")<{
  readonly message: string;
  readonly channel?: string;
  readonly cause?: unknown;
}> {}

// Helper to wrap unknown errors into PiDeskError
export const fromUnknownError = (
  error: unknown,
  context?: string,
): PiDeskError => {
  const message = context
    ? `${context}: ${error instanceof Error ? error.message : String(error)}`
    : error instanceof Error
      ? error.message
      : String(error);

  return new PiDeskError({ message, cause: error });
};

// Helper to wrap async operations with error handling - generic version
export const tryPromise = <A, E>(
  operation: () => Promise<A>,
  errorMapper: (error: unknown) => E,
): Effect.Effect<A, E> => {
  return Effect.tryPromise({
    try: operation,
    catch: errorMapper,
  });
};

// Helper for synchronous operations - generic version
export const trySync = <A, E>(
  operation: () => A,
  errorMapper: (error: unknown) => E,
): Effect.Effect<A, E> => {
  return Effect.try({
    try: operation,
    catch: errorMapper,
  });
};
