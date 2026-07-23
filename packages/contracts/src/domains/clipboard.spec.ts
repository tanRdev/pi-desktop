import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ClipboardWriteTextRequestSchema } from "./clipboard.js";

describe("ClipboardWriteTextRequestSchema", () => {
  it("accepts a text payload", () => {
    expect(
      Schema.decodeUnknownSync(ClipboardWriteTextRequestSchema)({
        text: "hello",
      }),
    ).toEqual({ text: "hello" });
  });

  it("rejects missing text", () => {
    expect(() =>
      Schema.decodeUnknownSync(ClipboardWriteTextRequestSchema)({}),
    ).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(ClipboardWriteTextRequestSchema)({
        text: "hello",
        html: "<b>hello</b>",
      }),
    ).toThrow(/unknown field "html"/);
  });
});
