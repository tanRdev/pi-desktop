import { describe, expect, it } from "vitest";

import { decodeVersionedEnvelope } from "./document-catalog.js";

describe("decodeVersionedEnvelope", () => {
  it("fails instead of hanging when a migration does not advance the version", () => {
    const result = decodeVersionedEnvelope(
      { schemaVersion: 1, data: { value: "old" } },
      {
        currentVersion: 2,
        migrations: [
          {
            from: 1,
            to: 1,
            migrate: (data) => data,
          },
        ],
        decode: (data) => data,
      },
    );

    expect(result).toEqual({ ok: false, reason: "bad-envelope" });
  });
});
