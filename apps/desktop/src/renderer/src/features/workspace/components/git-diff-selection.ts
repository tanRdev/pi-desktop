import type { GitDiffLine, GitFileDiff } from "@pi-desktop/shared";

/**
 * Selected-diff-line questions (issue #12).
 *
 * A selection is a list of line coordinates. Every coordinate retains
 * BOTH the old-side and the new-side line number (either may be null
 * for added/removed lines) plus the side the user picked the line
 * from, so a question built from the selection can be answered
 * against either revision of the file.
 */

export type DiffLineSide = "old" | "new";

export interface DiffLineCoordinate {
  side: DiffLineSide;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  type: GitDiffLine["type"];
  content: string;
}

export function coordinateForDiffLine(
  line: GitDiffLine,
): DiffLineCoordinate | null {
  switch (line.type) {
    case "remove":
      return {
        side: "old",
        oldLineNumber: line.oldLineNumber,
        newLineNumber: line.newLineNumber,
        type: line.type,
        content: line.content,
      };
    case "add":
    case "context":
      return {
        side: "new",
        oldLineNumber: line.oldLineNumber,
        newLineNumber: line.newLineNumber,
        type: line.type,
        content: line.content,
      };
    default:
      return null;
  }
}

export function diffLineSelectionKey(coordinate: DiffLineCoordinate): string {
  const lineNumber =
    coordinate.side === "old"
      ? coordinate.oldLineNumber
      : coordinate.newLineNumber;
  return `${coordinate.side}:${lineNumber ?? "?"}`;
}

export function isDiffLineSelected(
  selection: DiffLineCoordinate[],
  line: GitDiffLine,
): boolean {
  const coordinate = coordinateForDiffLine(line);
  if (!coordinate) return false;
  const key = diffLineSelectionKey(coordinate);
  return selection.some((entry) => diffLineSelectionKey(entry) === key);
}

export function toggleDiffLineSelection(
  selection: DiffLineCoordinate[],
  line: GitDiffLine,
): DiffLineCoordinate[] {
  const coordinate = coordinateForDiffLine(line);
  if (!coordinate) return selection;

  const key = diffLineSelectionKey(coordinate);
  if (selection.some((entry) => diffLineSelectionKey(entry) === key)) {
    return selection.filter((entry) => diffLineSelectionKey(entry) !== key);
  }

  return [...selection, coordinate].sort(compareCoordinates);
}

function compareCoordinates(
  left: DiffLineCoordinate,
  right: DiffLineCoordinate,
): number {
  const leftLine = left.newLineNumber ?? left.oldLineNumber ?? 0;
  const rightLine = right.newLineNumber ?? right.oldLineNumber ?? 0;
  if (leftLine !== rightLine) return leftLine - rightLine;
  if (left.side === right.side) return 0;
  return left.side === "old" ? -1 : 1;
}

function formatCoordinateLabel(coordinate: DiffLineCoordinate): string {
  const oldLabel =
    coordinate.oldLineNumber === null ? "—" : `${coordinate.oldLineNumber}`;
  const newLabel =
    coordinate.newLineNumber === null ? "—" : `${coordinate.newLineNumber}`;
  return `old line ${oldLabel} / new line ${newLabel} (${coordinate.side} side)`;
}

function formatCoordinatePrefix(coordinate: DiffLineCoordinate): string {
  switch (coordinate.type) {
    case "add":
      return "+ ";
    case "remove":
      return "- ";
    default:
      return "  ";
  }
}

/**
 * Build the question prompt for the selected diff lines. The selected
 * lines are quoted with their old/new coordinates so the agent can
 * locate them in either revision; the user question is appended when
 * one is supplied.
 */
export function formatDiffSelectionQuestion(
  diff: GitFileDiff,
  selection: DiffLineCoordinate[],
  question?: string,
): string {
  const sorted = [...selection].sort(compareCoordinates);
  const lines = sorted.map(
    (coordinate) =>
      `- [${formatCoordinateLabel(coordinate)}] ${formatCoordinatePrefix(coordinate)}${coordinate.content}`,
  );
  const header =
    selection.length === 1
      ? `Question about a selected diff line in ${diff.filePath}:`
      : `Question about ${selection.length} selected diff lines in ${diff.filePath}:`;
  const body = [header, ...lines].join("\n");
  const trimmedQuestion = question?.trim();
  return trimmedQuestion ? `${body}\n\n${trimmedQuestion}` : body;
}

export function pairRemoveAddLines(
  lines: GitDiffLine[],
): Map<number, GitDiffLine | null> {
  const paired = new Map<number, GitDiffLine | null>();
  let lastRemoveIndex: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.type === "remove") {
      lastRemoveIndex = i;
    } else if (line.type === "add" && lastRemoveIndex !== null) {
      const removeLine = lines[lastRemoveIndex];
      if (removeLine) {
        paired.set(lastRemoveIndex, line);
        paired.set(i, removeLine);
      }
      lastRemoveIndex = null;
    } else if (line.type === "context" || line.type === "hunk_header") {
      lastRemoveIndex = null;
    }
  }

  return paired;
}

/**
 * Re-serialize a diff to a unified-ish text form suitable for clipboard copy.
 * Not a strict git-format emitter; preserves +/- prefix and context space.
 */
export function serializeDiffForClipboard(diff: GitFileDiff): string {
  const header = `--- a/${diff.oldFilePath ?? diff.filePath}\n+++ b/${diff.filePath}`;
  const body = diff.hunks
    .map((hunk) => {
      const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
      const lines = hunk.lines
        .map((line) => {
          const prefix =
            line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
          return `${prefix}${line.content}`;
        })
        .join("\n");
      return `${hunkHeader}\n${lines}`;
    })
    .join("\n");
  return `${header}\n${body}`;
}
