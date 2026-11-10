import { Effect, Either } from "effect";

// A single RPC frame (or the not-yet-terminated remainder of one) may not
// grow without bound: a peer that never sends a newline must not be able to
// exhaust host memory. Oversized lines and remainders are dropped, which
// resynchronizes framing at the next newline; the dropped payload fails
// JSON parsing downstream like any other malformed frame.
export const MAX_RPC_LINE_CHARS = 16 * 1024 * 1024;

export function safeJsonParse(text: string): unknown | null {
  const result = Effect.runSync(
    Effect.either(
      Effect.try({
        try: () => JSON.parse(text),
        catch: () => null,
      }),
    ),
  );

  return Either.isRight(result) ? result.right : null;
}

export function consumeJsonLines(
  buffer: string,
  chunk: string,
): { lines: string[]; remainder: string } {
  const nextBuffer = buffer + chunk;
  const segments = nextBuffer.split("\n");
  const rawRemainder = segments.pop() ?? "";
  const lines = segments.filter(
    (line) => line.trim().length > 0 && line.length <= MAX_RPC_LINE_CHARS,
  );
  const remainder =
    rawRemainder.length <= MAX_RPC_LINE_CHARS ? rawRemainder : "";

  return { lines, remainder };
}

export function serializeRpcCommand(command: {
  type: string;
  [key: string]: unknown;
}): string {
  return `${JSON.stringify(command)}\n`;
}
