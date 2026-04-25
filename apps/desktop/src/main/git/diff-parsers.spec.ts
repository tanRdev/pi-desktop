import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./diff-parsers";

describe("git diff parsers", () => {
  it("parses unified diff hunks including no-newline markers", () => {
    const diffOutput = [
      "diff --git a/file.txt b/file.txt",
      "--- a/file.txt",
      "+++ b/file.txt",
      "@@ -1,2 +1,2 @@",
      " line one",
      "-line two",
      "+line two updated",
      "\\ No newline at end of file",
      "@@ -5 +5,2 @@",
      " line five",
      "+line six",
    ].join("\n");

    expect(parseUnifiedDiff(diffOutput)).toEqual([
      {
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 2,
        lines: [
          {
            type: "context",
            content: "line one",
            oldLineNumber: 1,
            newLineNumber: 1,
          },
          {
            type: "remove",
            content: "line two",
            oldLineNumber: 2,
            newLineNumber: null,
          },
          {
            type: "add",
            content: "line two updated",
            oldLineNumber: null,
            newLineNumber: 2,
          },
          {
            type: "context",
            content: "No newline at end of file",
            oldLineNumber: null,
            newLineNumber: null,
          },
        ],
      },
      {
        oldStart: 5,
        oldCount: 1,
        newStart: 5,
        newCount: 2,
        lines: [
          {
            type: "context",
            content: "line five",
            oldLineNumber: 5,
            newLineNumber: 5,
          },
          {
            type: "add",
            content: "line six",
            oldLineNumber: null,
            newLineNumber: 6,
          },
        ],
      },
    ]);
  });
});
