import { Either, ParseResult, Schema } from "effect";

/**
 * Decode an object payload while rejecting keys outside `allowedKeys`.
 * Effect `Schema.Struct` strips excess keys by default; this preserves the
 * security invariant from `payload-parsers.ts` strict parsers.
 */
export function createStrictObjectSchema<T>(
  allowedKeys: ReadonlySet<string>,
  fields: Schema.Struct.Fields,
  options?: { readonly acceptMissing?: boolean },
): Schema.Schema<T> {
  const struct = Schema.Struct(fields);
  const acceptMissing = options?.acceptMissing ?? false;

  return Schema.transformOrFail(Schema.Unknown, struct, {
    strict: false,
    decode: (input, _, ast) => {
      if (input === undefined || input === null) {
        if (acceptMissing) {
          return ParseResult.succeed({} as T);
        }
        return ParseResult.fail(
          new ParseResult.Type(ast, input, "expected object"),
        );
      }
      if (typeof input !== "object" || Array.isArray(input)) {
        return ParseResult.fail(
          new ParseResult.Type(ast, input, "expected object"),
        );
      }

      for (const key of Object.keys(input as Record<string, unknown>)) {
        if (!allowedKeys.has(key)) {
          return ParseResult.fail(
            new ParseResult.Type(ast, input, `unknown field "${key}"`),
          );
        }
      }

      return Either.match(
        Schema.decodeUnknownEither(struct as unknown as Schema.Schema<T>)(
          input,
        ),
        {
          onLeft: (error) => ParseResult.fail(error.issue),
          onRight: (value) => ParseResult.succeed(value),
        },
      );
    },
    encode: (value) => ParseResult.succeed(value),
  }) as unknown as Schema.Schema<T>;
}

export const MAX_EXTERNAL_URL_BYTES = 2048;

function isHttpOrHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Shared http/https URL guard with byte-length cap for openExternal. */
export const HttpOrHttpsUrlSchema = Schema.String.pipe(
  Schema.filter(
    (url) => Buffer.byteLength(url, "utf-8") <= MAX_EXTERNAL_URL_BYTES,
    {
      message: () =>
        `openExternal url exceeds maximum size of ${MAX_EXTERNAL_URL_BYTES} bytes`,
    },
  ),
  Schema.filter(isHttpOrHttpsUrl, {
    message: () => "openExternal url must be a valid http or https URL",
  }),
);
