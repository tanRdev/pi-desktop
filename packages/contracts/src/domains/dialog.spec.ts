import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  OpenExternalRequestSchema,
  ShowOpenDialogOptionsSchema,
} from "./dialog.js";

describe("ShowOpenDialogOptionsSchema", () => {
  it("accepts empty and known dialog options", () => {
    expect(
      Schema.decodeUnknownSync(ShowOpenDialogOptionsSchema)(undefined),
    ).toEqual({});
    expect(
      Schema.decodeUnknownSync(ShowOpenDialogOptionsSchema)({
        title: "Pick a file",
        properties: ["openFile", "multiSelections"],
      }),
    ).toEqual({
      title: "Pick a file",
      properties: ["openFile", "multiSelections"],
    });
  });

  it("rejects unknown dialog option keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(ShowOpenDialogOptionsSchema)({
        defaultPath: "/etc/passwd",
      }),
    ).toThrow(/unknown field "defaultPath"/);
  });

  it("rejects invalid property literals", () => {
    expect(() =>
      Schema.decodeUnknownSync(ShowOpenDialogOptionsSchema)({
        properties: ["openFile", "defaultPath"],
      }),
    ).toThrow();
  });
});

describe("OpenExternalRequestSchema", () => {
  it("accepts http and https URLs within the size cap", () => {
    expect(
      Schema.decodeUnknownSync(OpenExternalRequestSchema)({
        url: "https://example.com/docs",
      }),
    ).toEqual({ url: "https://example.com/docs" });
  });

  it("rejects non-http(s) protocols", () => {
    expect(() =>
      Schema.decodeUnknownSync(OpenExternalRequestSchema)({
        url: "javascript:alert(1)",
      }),
    ).toThrow(/http or https/);
  });

  it("rejects oversized URLs", () => {
    expect(() =>
      Schema.decodeUnknownSync(OpenExternalRequestSchema)({
        url: `https://example.com/${"a".repeat(2048)}`,
      }),
    ).toThrow(/maximum size/);
  });

  it("rejects unknown request keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(OpenExternalRequestSchema)({
        url: "https://example.com",
        sandbox: false,
      }),
    ).toThrow(/unknown field "sandbox"/);
  });
});
