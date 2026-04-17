import { describe, expect, it } from "vitest";

import { type ContextWindow, getMainPaneState } from "./workspace-pane-state";

const baseWindow = {
  title: "",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  zIndex: 1,
  isFocused: false,
  state: "normal" as const,
};

function makeFileWindow(id: string, filePath = `/tmp/${id}.ts`): ContextWindow {
  return {
    ...baseWindow,
    id,
    kind: "file",
    filePath,
    isDirty: false,
  };
}

function makeTerminalWindow(id: string): ContextWindow {
  return {
    ...baseWindow,
    id,
    kind: "terminal",
    terminalId: id,
    backend: "shell",
    cwd: "/tmp",
  };
}

function makeGitWindow(id: string): ContextWindow {
  return {
    ...baseWindow,
    id,
    kind: "git",
    repositoryPath: "/tmp/repo",
  };
}

describe("getMainPaneState", () => {
  it("returns empty state when no surface selected", () => {
    const result = getMainPaneState({
      contextWindows: [makeFileWindow("f1"), makeTerminalWindow("t1")],
      selectedContextSurface: null,
    });

    expect(result).toEqual({
      fileWindows: ["f1"],
      selectedFileWindowId: null,
      sideSurfaceKey: null,
    });
  });

  it("returns activity side surface when selected", () => {
    const result = getMainPaneState({
      contextWindows: [makeFileWindow("f1")],
      selectedContextSurface: "activity",
    });

    expect(result.sideSurfaceKey).toBe("activity");
    expect(result.selectedFileWindowId).toBeNull();
    expect(result.fileWindows).toEqual(["f1"]);
  });

  it("selects a file window when its id is selected", () => {
    const result = getMainPaneState({
      contextWindows: [makeFileWindow("f1"), makeFileWindow("f2")],
      selectedContextSurface: "f2",
    });

    expect(result.selectedFileWindowId).toBe("f2");
    expect(result.sideSurfaceKey).toBeNull();
    expect(result.fileWindows).toEqual(["f1", "f2"]);
  });

  it("selects a terminal as side surface", () => {
    const result = getMainPaneState({
      contextWindows: [makeFileWindow("f1"), makeTerminalWindow("t1")],
      selectedContextSurface: "t1",
    });

    expect(result.selectedFileWindowId).toBeNull();
    expect(result.sideSurfaceKey).toBe("t1");
  });

  it("selects a git window as side surface", () => {
    const result = getMainPaneState({
      contextWindows: [makeGitWindow("g1")],
      selectedContextSurface: "g1",
    });

    expect(result.sideSurfaceKey).toBe("g1");
  });

  it("falls back to null state when selected id is unknown", () => {
    const result = getMainPaneState({
      contextWindows: [makeFileWindow("f1")],
      selectedContextSurface: "missing",
    });

    expect(result).toEqual({
      fileWindows: ["f1"],
      selectedFileWindowId: null,
      sideSurfaceKey: null,
    });
  });

  it("filters fileWindows to only file kinds", () => {
    const result = getMainPaneState({
      contextWindows: [
        makeFileWindow("f1"),
        makeTerminalWindow("t1"),
        makeGitWindow("g1"),
        makeFileWindow("f2"),
      ],
      selectedContextSurface: null,
    });

    expect(result.fileWindows).toEqual(["f1", "f2"]);
  });
});
