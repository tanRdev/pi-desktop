import { Data, Effect } from "effect";

/**
 * Stable error codes. These strings are part of the IPC contract — once
 * emitted, don't rename them. Add new variants at the end.
 */
export type PiErrorCode =
  | "EINTERNAL"
  | "EINVALID_INPUT"
  | "EIPC_INVALID"
  | "EIPC_TIMEOUT"
  | "EIPC_RATE_LIMITED"
  | "EFS_NOT_FOUND"
  | "EFS_PERMISSION"
  | "EFS_TRAVERSAL"
  | "EFS_TOO_LARGE"
  | "EREPO_NOT_FOUND"
  | "EREPO_INVALID"
  | "EGIT_FAILED"
  | "ETHREAD_NOT_FOUND"
  | "ETHREAD_INVALID"
  | "EAGENT_FAILED"
  | "EUPDATE_FAILED";

/**
 * Canonical PiError. Prefer `PiError.of(code, message, cause?)` at call
 * sites so codes stay grep-able.
 */
export class PiError extends Data.TaggedError("PiError")<{
  readonly code: PiErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}> {
  static of(code: PiErrorCode, message: string, cause?: unknown): PiError {
    return new PiError({ code, message, cause });
  }

  override toString(): string {
    return `PiError[${this.code}]: ${this.message}`;
  }
}

/** Back-compat alias. New code should use `PiError`. */
export class PiDesktopError extends Data.TaggedError("PiDesktopError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {
  override toString(): string {
    return `PiDesktopError: ${this.message}${this.cause ? ` (caused by: ${this.cause})` : ""}`;
  }
}

export class RepositoryError extends Data.TaggedError("RepositoryError")<{
  readonly code?: PiErrorCode;
  readonly message: string;
  readonly repositoryId?: string;
  readonly cause?: unknown;
}> {}

export class ThreadError extends Data.TaggedError("ThreadError")<{
  readonly code?: PiErrorCode;
  readonly message: string;
  readonly threadId?: string;
  readonly cause?: unknown;
}> {}

export class FileSystemError extends Data.TaggedError("FileSystemError")<{
  readonly code?: PiErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly cause?: unknown;
}> {}

export class IPCError extends Data.TaggedError("IPCError")<{
  readonly code?: PiErrorCode;
  readonly message: string;
  readonly channel?: string;
  readonly cause?: unknown;
}> {}

export class GitError extends Data.TaggedError("GitError")<{
  readonly code?: PiErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly cause?: unknown;
}> {}

export class TerminalError extends Data.TaggedError("TerminalError")<{
  readonly code?: PiErrorCode;
  readonly message: string;
  readonly terminalId?: string;
  readonly cause?: unknown;
}> {}

/** Union of every tagged error raised by main-process effects. */
export type PiDesktopAnyError =
  | PiError
  | PiDesktopError
  | RepositoryError
  | ThreadError
  | FileSystemError
  | IPCError
  | GitError
  | TerminalError;

/** Wrap an arbitrary thrown value into a `PiDesktopError`. */
export const fromUnknownError = (
  error: unknown,
  context?: string,
): PiDesktopError => {
  const message = context
    ? `${context}: ${error instanceof Error ? error.message : String(error)}`
    : error instanceof Error
      ? error.message
      : String(error);
  return new PiDesktopError({ message, cause: error });
};

/** Wrap an arbitrary thrown value into a coded `PiError`. */
export const toPiError = (
  code: PiErrorCode,
  error: unknown,
  context?: string,
): PiError => {
  const base = error instanceof Error ? error.message : String(error);
  const message = context ? `${context}: ${base}` : base;
  return PiError.of(code, message, error);
};

export const tryPromise = <A, E>(
  operation: () => Promise<A>,
  errorMapper: (error: unknown) => E,
): Effect.Effect<A, E> =>
  Effect.tryPromise({ try: operation, catch: errorMapper });

export const trySync = <A, E>(
  operation: () => A,
  errorMapper: (error: unknown) => E,
): Effect.Effect<A, E> => Effect.try({ try: operation, catch: errorMapper });
