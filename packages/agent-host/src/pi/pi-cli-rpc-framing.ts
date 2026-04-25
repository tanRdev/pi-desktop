import { Effect, Either } from "effect";

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
  const remainder = segments.pop() ?? "";
  const lines = segments.filter((line) => line.trim().length > 0);

  return { lines, remainder };
}

export function serializeRpcCommand(command: {
  type: string;
  [key: string]: unknown;
}): string {
  return `${JSON.stringify(command)}\n`;
}
