import type { GitDiffLine, GitFileDiff } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import {
  coordinateForDiffLine,
  type DiffLineCoordinate,
  formatDiffSelectionQuestion,
  isDiffLineSelected,
  toggleDiffLineSelection,
} from "./git-diff-selection";

function mustCoordinate(lineValue: GitDiffLine): DiffLineCoordinate {
  const coordinate = coordinateForDiffLine(lineValue);
  if (!coordinate) throw new Error("expected a selectable diff line");
  return coordinate;
}

function line(overrides: Partial<GitDiffLine>): GitDiffLine {
  return {
    type: "context",
    content: "code",
    oldLineNumber: 1,
    newLineNumber: 1,
    ...overrides,
  };
}

const diff: GitFileDiff = {
  filePath: "src/app.ts",
  oldFilePath: null,
  status: "modified",
  binary: false,
  hunks: [],
};

describe("coordinateForDiffLine", () => {
  it("keeps removed lines on the old side with both coordinates", () => {
    expect(
      coordinateForDiffLine(
        line({ type: "remove", oldLineNumber: 12, newLineNumber: null }),
      ),
    ).toEqual({
      side: "old",
      oldLineNumber: 12,
      newLineNumber: null,
      type: "remove",
      content: "code",
    });
  });

  it("keeps added lines on the new side with both coordinates", () => {
    expect(
      coordinateForDiffLine(
        line({ type: "add", oldLineNumber: null, newLineNumber: 30 }),
      ),
    ).toEqual({
      side: "new",
      oldLineNumber: null,
      newLineNumber: 30,
      type: "add",
      content: "code",
    });
  });

  it("retains both line numbers for context lines", () => {
    expect(
      coordinateForDiffLine(
        line({ type: "context", oldLineNumber: 4, newLineNumber: 9 }),
      ),
    ).toEqual({
      side: "new",
      oldLineNumber: 4,
      newLineNumber: 9,
      type: "context",
      content: "code",
    });
  });

  it("returns null for hunk headers", () => {
    expect(coordinateForDiffLine(line({ type: "hunk_header" }))).toBeNull();
  });
});

describe("toggleDiffLineSelection", () => {
  it("adds, sorts, and removes coordinates by side and line number", () => {
    const add = line({ type: "add", oldLineNumber: null, newLineNumber: 30 });
    const remove = line({
      type: "remove",
      oldLineNumber: 12,
      newLineNumber: null,
    });

    let selection = toggleDiffLineSelection([], add);
    selection = toggleDiffLineSelection(selection, remove);

    expect(selection.map((entry) => entry.side)).toEqual(["old", "new"]);
    expect(isDiffLineSelected(selection, add)).toBe(true);
    expect(isDiffLineSelected(selection, remove)).toBe(true);

    selection = toggleDiffLineSelection(selection, add);
    expect(selection).toHaveLength(1);
    expect(isDiffLineSelected(selection, add)).toBe(false);
  });

  it("ignores hunk headers", () => {
    expect(toggleDiffLineSelection([], line({ type: "hunk_header" }))).toEqual(
      [],
    );
  });
});

describe("formatDiffSelectionQuestion", () => {
  it("quotes selected lines with old and new coordinates", () => {
    const selection = [
      mustCoordinate(
        line({
          type: "remove",
          content: "oldCall()",
          oldLineNumber: 12,
          newLineNumber: null,
        }),
      ),
      mustCoordinate(
        line({
          type: "add",
          content: "newCall()",
          oldLineNumber: null,
          newLineNumber: 12,
        }),
      ),
    ];

    const question = formatDiffSelectionQuestion(
      diff,
      selection,
      "Why did this call change?",
    );

    expect(question).toContain("src/app.ts");
    expect(question).toContain("old line 12 / new line — (old side)");
    expect(question).toContain("- oldCall()");
    expect(question).toContain("old line — / new line 12 (new side)");
    expect(question).toContain("+ newCall()");
    expect(question).toContain("Why did this call change?");
  });

  it("omits the trailing question when none is supplied", () => {
    const selection = [
      mustCoordinate(
        line({ type: "context", oldLineNumber: 3, newLineNumber: 5 }),
      ),
    ];

    const question = formatDiffSelectionQuestion(diff, selection);

    expect(question).toContain(
      "Question about a selected diff line in src/app.ts:",
    );
    expect(question).toContain("old line 3 / new line 5 (new side)");
    expect(question.endsWith("code")).toBe(true);
  });
});
