import { Schema } from "effect";

/** Mirrors `MAX_STRING_BYTES` in payload-parsers — generic inbound string cap. */
export const MAX_IPC_STRING_BYTES = 1_048_576;

/** Mirrors filesystem handler write cap. */
export const MAX_WRITE_FILE_BYTES = 10 * 1024 * 1024;

/** Mirrors terminal.write handler cap. */
export const MAX_TERMINAL_WRITE_BYTES = 64 * 1024;

const byteLength = (value: string): number => Buffer.byteLength(value, "utf-8");

export function ipcStringSchema(
  maxBytes: number = MAX_IPC_STRING_BYTES,
): Schema.Schema<string> {
  return Schema.String.pipe(
    Schema.filter((value) => byteLength(value) <= maxBytes, {
      message: () => `string exceeds maximum size of ${maxBytes} bytes`,
    }),
  );
}

export function finiteNumberSchema(): Schema.Schema<number> {
  return Schema.Number.pipe(
    Schema.filter((value) => Number.isFinite(value), {
      message: () => "must be a finite number",
    }),
  );
}

export function terminalWriteDataSchema(): Schema.Schema<string> {
  return Schema.String.pipe(
    Schema.filter(
      (value) =>
        value.length <= MAX_TERMINAL_WRITE_BYTES &&
        byteLength(value) <= MAX_TERMINAL_WRITE_BYTES,
      {
        message: () =>
          `data exceeds maximum size of ${MAX_TERMINAL_WRITE_BYTES} bytes`,
      },
    ),
  );
}

export const mutableArray = <A, I, R>(item: Schema.Schema<A, I, R>) =>
  Schema.mutable(Schema.Array(item));
