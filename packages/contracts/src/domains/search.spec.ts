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
