import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

import {
  computeBackoff,
  createInitialUpdaterState,
  DEFAULT_BACKOFF,
  type UpdateInfoSnapshot,
  type UpdaterState,
  updaterReducer,
} from "./auto-updater";

const INFO: UpdateInfoSnapshot = {
  version: "1.2.3",
  releaseNotes: null,
  releaseName: null,
  releaseDate: null,
};

function freshState(): UpdaterState {
  return createInitialUpdaterState();
}

describe("updaterReducer", () => {
  it("transitions idle -> checking on CHECK_START", () => {
    const next = updaterReducer(freshState(), { type: "CHECK_START" });
    expect(next.status).toBe("checking");
    expect(next.lastCheckAt).not.toBeNull();
  });

  it("returns to idle when no update is available", () => {
    const checking = updaterReducer(freshState(), { type: "CHECK_START" });
    const next = updaterReducer(checking, { type: "CHECK_COMPLETE_NO_UPDATE" });
    expect(next.status).toBe("idle");
    expect(next.errorCount).toBe(0);
  });

  it("moves to available on UPDATE_AVAILABLE", () => {
    const next = updaterReducer(freshState(), {
      type: "UPDATE_AVAILABLE",
      info: INFO,
    });
    expect(next.status).toBe("available");
    expect(next.updateInfo).toEqual(INFO);
  });

  it("flows available -> downloading -> downloaded -> restart-pending", () => {
    let state = freshState();
    state = updaterReducer(state, { type: "UPDATE_AVAILABLE", info: INFO });
    state = updaterReducer(state, { type: "DOWNLOAD_START" });
    expect(state.status).toBe("downloading");
    state = updaterReducer(state, { type: "DOWNLOAD_PROGRESS", percent: 42 });
    expect(state.downloadPercent).toBe(42);
    state = updaterReducer(state, { type: "DOWNLOAD_COMPLETE" });
    expect(state.status).toBe("downloaded");
    state = updaterReducer(state, { type: "INSTALL_REQUESTED" });
    expect(state.status).toBe("restart-pending");
  });

  it("ignores DOWNLOAD_START when not available", () => {
    const state = freshState();
    const next = updaterReducer(state, { type: "DOWNLOAD_START" });
    expect(next.status).toBe("idle");
  });

  it("clamps download progress to [0,100]", () => {
    let state = updaterReducer(freshState(), {
      type: "UPDATE_AVAILABLE",
      info: INFO,
    });
    state = updaterReducer(state, { type: "DOWNLOAD_START" });
    const over = updaterReducer(state, {
      type: "DOWNLOAD_PROGRESS",
      percent: 250,
    });
    expect(over.downloadPercent).toBe(100);
    const under = updaterReducer(state, {
      type: "DOWNLOAD_PROGRESS",
      percent: -5,
    });
    expect(under.downloadPercent).toBe(0);
  });

  it("records errors and increments errorCount", () => {
    const first = updaterReducer(freshState(), {
      type: "ERROR",
      message: "boom",
    });
    expect(first.status).toBe("error");
    expect(first.errorCount).toBe(1);
    expect(first.error?.attempt).toBe(1);
    const second = updaterReducer(first, { type: "ERROR", message: "again" });
    expect(second.errorCount).toBe(2);
    expect(second.error?.attempt).toBe(2);
  });

  it("does not allow checking while downloading", () => {
    let state = updaterReducer(freshState(), {
      type: "UPDATE_AVAILABLE",
      info: INFO,
    });
    state = updaterReducer(state, { type: "DOWNLOAD_START" });
    const next = updaterReducer(state, { type: "CHECK_START" });
    expect(next.status).toBe("downloading");
  });

  it("RESET preserves consent", () => {
    let state = updaterReducer(freshState(), {
      type: "CONSENT_SET",
      consented: true,
    });
    state = updaterReducer(state, { type: "UPDATE_AVAILABLE", info: INFO });
    state = updaterReducer(state, { type: "RESET" });
    expect(state.status).toBe("idle");
    expect(state.userConsented).toBe(true);
  });

  it("ignores INSTALL_REQUESTED when not downloaded", () => {
    const state = updaterReducer(freshState(), {
      type: "UPDATE_AVAILABLE",
      info: INFO,
    });
    const next = updaterReducer(state, { type: "INSTALL_REQUESTED" });
    expect(next.status).toBe("available");
  });

  it("allows download retry from error state", () => {
    let state = updaterReducer(freshState(), {
      type: "UPDATE_AVAILABLE",
      info: INFO,
    });
    state = updaterReducer(state, { type: "ERROR", message: "net" });
    const next = updaterReducer(state, { type: "DOWNLOAD_START" });
    expect(next.status).toBe("downloading");
  });
});

describe("computeBackoff", () => {
  it("returns base delay on attempt 0", () => {
    expect(computeBackoff(0)).toBe(DEFAULT_BACKOFF.baseMs);
  });

  it("grows exponentially up to the ceiling", () => {
    const a1 = computeBackoff(1);
    const a3 = computeBackoff(3);
    const a20 = computeBackoff(20);
    expect(a1).toBe(DEFAULT_BACKOFF.baseMs);
    expect(a3).toBeGreaterThan(a1);
    expect(a20).toBeLessThanOrEqual(DEFAULT_BACKOFF.maxMs);
  });

  it("respects custom config", () => {
    const cfg = { baseMs: 10, factor: 3, maxMs: 1000 };
    expect(computeBackoff(1, cfg)).toBe(10);
    expect(computeBackoff(2, cfg)).toBe(30);
    expect(computeBackoff(3, cfg)).toBe(90);
    expect(computeBackoff(10, cfg)).toBe(1000);
  });
});
