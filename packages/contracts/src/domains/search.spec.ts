import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { SearchRequestSchema, SearchResponseSchema } from "./search.js";

describe("SearchRequestSchema", () => {
  it("accepts required and optional search fields", () => {
    expect(
      Schema.decodeUnknownSync(SearchRequestSchema)({
        query: "app",
        rootPath: "/tmp/pi-desktop",
        maxResults: 25,
        includePatterns: ["*.ts"],
        excludePatterns: ["node_modules"],
      }),
    ).toEqual({
      query: "app",
      rootPath: "/tmp/pi-desktop",
      maxResults: 25,
      includePatterns: ["*.ts"],
      excludePatterns: ["node_modules"],
    });
  });

  it("rejects missing required fields", () => {
    expect(() =>
      Schema.decodeUnknownSync(SearchRequestSchema)({ query: "app" }),
    ).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(SearchRequestSchema)({
        query: "app",
        rootPath: "/tmp/pi-desktop",
        cwd: "/etc",
      }),
    ).toThrow(/unknown field "cwd"/);
  });

  it.each([
    Number.NEGATIVE_INFINITY,
    -1,
    0,
    1.5,
    201,
    Number.POSITIVE_INFINITY,
    Number.NaN,
  ])("rejects maxResults outside the finite integer range: %s", (maxResults) => {
    expect(() =>
      Schema.decodeUnknownSync(SearchRequestSchema)({
        query: "app",
        rootPath: "/tmp/pi-desktop",
        maxResults,
      }),
    ).toThrow();
  });

  it("rejects a query above 512 UTF-8 bytes", () => {
    expect(() =>
      Schema.decodeUnknownSync(SearchRequestSchema)({
        query: "💥".repeat(129),
        rootPath: "/tmp/pi-desktop",
      }),
    ).toThrow();
  });

  it("rejects a root path above 4096 UTF-8 bytes", () => {
    expect(() =>
      Schema.decodeUnknownSync(SearchRequestSchema)({
        query: "app",
        rootPath: `/${"💥".repeat(1025)}`,
      }),
    ).toThrow();
  });

  it.each([
    "includePatterns",
    "excludePatterns",
  ] as const)("rejects an oversized pattern in %s", (patternField) => {
    expect(() =>
      Schema.decodeUnknownSync(SearchRequestSchema)({
        query: "app",
        rootPath: "/tmp/pi-desktop",
        [patternField]: ["💥".repeat(129)],
      }),
    ).toThrow();
  });

  it.each([
    "includePatterns",
    "excludePatterns",
  ] as const)("rejects more than 50 entries in %s", (patternField) => {
    expect(() =>
      Schema.decodeUnknownSync(SearchRequestSchema)({
        query: "app",
        rootPath: "/tmp/pi-desktop",
        [patternField]: Array.from({ length: 51 }, (_, index) => String(index)),
      }),
    ).toThrow();
  });
});

describe("SearchResponseSchema", () => {
  it("accepts a search response payload", () => {
    expect(
      Schema.decodeUnknownSync(SearchResponseSchema)({
        query: "app",
        results: [
          {
            path: "/tmp/pi-desktop/app.tsx",
            name: "app.tsx",
            score: 100,
            type: "file",
          },
        ],
        total: 1,
        duration: 4,
      }),
    ).toEqual({
      query: "app",
      results: [
        {
          path: "/tmp/pi-desktop/app.tsx",
          name: "app.tsx",
          score: 100,
          type: "file",
        },
      ],
      total: 1,
      duration: 4,
    });
  });

  it("rejects malformed result entries", () => {
    expect(() =>
      Schema.decodeUnknownSync(SearchResponseSchema)({
        query: "app",
        results: [
          { path: "/tmp", name: "app.tsx", score: "high", type: "file" },
        ],
        total: 1,
        duration: 4,
      }),
    ).toThrow();
  });
});
