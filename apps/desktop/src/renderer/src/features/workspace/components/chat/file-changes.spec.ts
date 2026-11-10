import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import {
  extractToolFilePath,
  isFileMutationToolMessage,
  summarizeFileChanges,
} from "./file-changes";

function toolMessage(
  overrides: Partial<AgentMessageSnapshot>,
): AgentMessageSnapshot {
  return {
    id: "tool:write:call-1",
    role: "tool",
    text: "",
    status: "complete",
    timestamp: 1,
    ...overrides,
  };
}

describe("isFileMutationToolMessage", () => {
  it("matches write/edit/create/delete and file tools", () => {
    expect(
      isFileMutationToolMessage(toolMessage({ id: "tool:write:c1" })),
    ).toBe(true);
    expect(
      isFileMutationToolMessage(toolMessage({ id: "tool:edit_file:c1" })),
    ).toBe(true);
    expect(
      isFileMutationToolMessage(toolMessage({ id: "tool:create:c1" })),
    ).toBe(true);
    expect(isFileMutationToolMessage(toolMessage({ id: "tool:read:c1" }))).toBe(
      false,
    );
    expect(
      isFileMutationToolMessage(
        toolMessage({ id: "tool:bash:c1", role: "assistant" }),
      ),
    ).toBe(false);
  });
});

describe("extractToolFilePath", () => {
  it("reads the path from JSON tool arguments", () => {
    expect(
      extractToolFilePath(
        toolMessage({ text: JSON.stringify({ path: "src/app.ts" }) }),
      ),
    ).toBe("src/app.ts");
    expect(
      extractToolFilePath(
        toolMessage({ text: JSON.stringify({ filePath: "docs/a.md" }) }),
      ),
    ).toBe("docs/a.md");
  });

  it("falls back to a path-like token in the tool-call id", () => {
    expect(
      extractToolFilePath(toolMessage({ id: "tool:write:src/legacy.ts" })),
    ).toBe("src/legacy.ts");
  });

  it("returns null when no path is present", () => {
    expect(
      extractToolFilePath(toolMessage({ id: "tool:write:call-9", text: "ok" })),
    ).toBeNull();
  });
});

describe("summarizeFileChanges", () => {
  it("counts each successfully changed file once, in first-change order", () => {
    const summary = summarizeFileChanges([
      toolMessage({
        id: "tool:write:c1",
        text: JSON.stringify({ path: "src/a.ts" }),
      }),
      toolMessage({
        id: "tool:edit:c2",
        text: JSON.stringify({ path: "src/b.ts" }),
      }),
      toolMessage({
        id: "tool:edit:c3",
        text: JSON.stringify({ path: "src/a.ts" }),
      }),
      toolMessage({
        id: "tool:write:c4",
        text: JSON.stringify({ path: "src/a.ts" }),
      }),
    ]);

    expect(summary).toEqual({
      filePaths: ["src/a.ts", "src/b.ts"],
      count: 2,
    });
  });

  it("excludes failed writes entirely", () => {
    const summary = summarizeFileChanges([
      toolMessage({
        id: "tool:write:c1",
        status: "error",
        text: JSON.stringify({ path: "src/failed.ts" }),
      }),
      toolMessage({
        id: "tool:write:c2",
        text: JSON.stringify({ path: "src/ok.ts" }),
      }),
    ]);

    expect(summary).toEqual({ filePaths: ["src/ok.ts"], count: 1 });
  });

  it("does not let a later failure erase an earlier success for the same file", () => {
    const summary = summarizeFileChanges([
      toolMessage({
        id: "tool:write:c1",
        text: JSON.stringify({ path: "src/a.ts" }),
      }),
      toolMessage({
        id: "tool:edit:c2",
        status: "error",
        text: JSON.stringify({ path: "src/a.ts" }),
      }),
    ]);

    expect(summary).toEqual({ filePaths: ["src/a.ts"], count: 1 });
  });

  it("excludes streaming (not yet successful) and non-mutation tools", () => {
    const summary = summarizeFileChanges([
      toolMessage({
        id: "tool:write:c1",
        status: "streaming",
        text: JSON.stringify({ path: "src/pending.ts" }),
      }),
      toolMessage({
        id: "tool:read:c2",
        text: JSON.stringify({ path: "src/read-only.ts" }),
      }),
      toolMessage({
        id: "tool:bash:c3",
        text: JSON.stringify({ path: "src/not-a-file-tool.ts" }),
      }),
    ]);

    expect(summary).toEqual({ filePaths: [], count: 0 });
  });

  it("ignores successful mutation calls without an identifiable path", () => {
    const summary = summarizeFileChanges([
      toolMessage({ id: "tool:write:c1", text: "done" }),
    ]);

    expect(summary).toEqual({ filePaths: [], count: 0 });
  });
});
