import type { GitDiffHunk } from "@pi-desktop/shared";

export function parseUnifiedDiff(diffOutput: string): GitDiffHunk[] {
  const hunks: GitDiffHunk[] = [];
  const lines = diffOutput.split(/\r?\n/);

  let currentHunk: GitDiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      currentHunk = {
        oldStart: Number(hunkMatch[1]),
        oldCount: Number(hunkMatch[2] ?? "1"),
        newStart: Number(hunkMatch[3]),
        newCount: Number(hunkMatch[4] ?? "1"),
        lines: [],
      };
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[3]);
      continue;
    }

    if (
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("diff ")
    ) {
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "add",
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLine++,
      });
      continue;
    }

    if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "remove",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: null,
      });
      continue;
    }

    if (line.startsWith(" ")) {
      currentHunk.lines.push({
        type: "context",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
      continue;
    }

    if (line.startsWith("\\ ")) {
      currentHunk.lines.push({
        type: "context",
        content: line.slice(2),
        oldLineNumber: null,
        newLineNumber: null,
      });
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}
