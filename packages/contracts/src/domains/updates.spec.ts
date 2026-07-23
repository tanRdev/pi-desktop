import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  UpdateInfoSnapshotSchema,
  UpdaterStateSchema,
  updatesContracts,
} from "./updates.js";

const sampleUpdaterState = {
  status: "idle" as const,
  updateInfo: null,
  downloadPercent: 0,
  error: null,
  errorCount: 0,
  lastCheckAt: null,
  userConsented: false,
};

describe("updates schemas", () => {
  it("accepts valid updater state payloads", () => {
    expect(
      Schema.decodeUnknownSync(UpdaterStateSchema)(sampleUpdaterState),
    ).toEqual(sampleUpdaterState);
  });

  it("accepts updater state with update info and error details", () => {
    expect(
      Schema.decodeUnknownSync(UpdaterStateSchema)({
        status: "available",
        updateInfo: {
          version: "1.2.3",
          releaseNotes: "Bug fixes",
          releaseName: "v1.2.3",
          releaseDate: "2026-01-01",
        },
        downloadPercent: 42,
        error: { message: "network", attempt: 1 },
        errorCount: 1,
        lastCheckAt: 1_700_000_000,
        userConsented: true,
      }),
    ).toMatchObject({
      status: "available",
      updateInfo: { version: "1.2.3" },
    });
  });

  it("rejects updater state with unknown status values", () => {
    expect(() =>
      Schema.decodeUnknownSync(UpdaterStateSchema)({
        ...sampleUpdaterState,
        status: "pending",
      }),
    ).toThrow();
  });

  it("accepts update info snapshots", () => {
    expect(
      Schema.decodeUnknownSync(UpdateInfoSnapshotSchema)({
        version: "2.0.0",
      }),
    ).toEqual({ version: "2.0.0" });
  });
});

describe("updatesContracts", () => {
  it("declares all updates invoke channels plus the event contract", () => {
    expect(updatesContracts.getState.channel).toBe("updates:getState");
    expect(updatesContracts.check.channel).toBe("updates:check");
    expect(updatesContracts.download.channel).toBe("updates:download");
    expect(updatesContracts.install.channel).toBe("updates:install");
    expect(updatesContracts.event.kind).toBe("event");
    expect(updatesContracts.event.channel).toBe("updates:event");
  });
});
