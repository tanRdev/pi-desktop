import type { AgentMessageSnapshot } from "@pi-desktop/shared";

/**
 * Change reporting for a chat turn (issue #12).
 *
 * Only *successful* file-mutation tool calls count as file changes:
 * a tool message whose status is "error" (failed write/edit) or
 * "streaming" (still running) never counts, and a file written by
 * several successful calls is reported once, in first-change order.
 */

const FILE_MUTATION_PREFIXES = ["write", "edit", "create", "delete"];

export function getToolName(message: AgentMessageSnapshot): string | null {
  const match = /^tool:([^:]+):/.exec(message.id);
  return match?.[1] ?? null;
}

export function isFileMutationToolMessage(
  message: AgentMessageSnapshot,
): boolean {
  if (message.role !== "tool") return false;
  const name = (getToolName(message) ?? "").toLowerCase();
  if (!name) return false;
  if (FILE_MUTATION_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return true;
  }
  return name.includes("file");
}

/**
 * Best-effort file path for a tool call. Pi tool arguments/results are
 * carried in the message text (JSON with a `path`/`filePath` field for
 * the built-in write/edit tools); fall back to a path-like token in the
 * tool-call id segment for ids that embed one.
 */
export function extractToolFilePath(
  message: AgentMessageSnapshot,
): string | null {
  const fromText = extractPathFromToolText(message.text);
  if (fromText) return fromText;

  const rest = message.id.split(":").slice(2).join(":");
  if (!rest) return null;

  const pathMatch = rest.match(/([\w./\-@]+\.[a-zA-Z0-9]+)/);
  return pathMatch?.[1] ?? null;
}

function extractPathFromToolText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    for (const key of ["path", "filePath"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  } catch {
    return null;
  }

  return null;
}

export interface FileChangeSummaryData {
  /** Unique paths of files changed by successful tool calls. */
  filePaths: string[];
  /** Always `filePaths.length` — unique successful changes only. */
  count: number;
}

export function summarizeFileChanges(
  messages: AgentMessageSnapshot[],
): FileChangeSummaryData {
  const seen = new Set<string>();
  const filePaths: string[] = [];

  for (const message of messages) {
    if (message.status !== "complete") continue;
    if (!isFileMutationToolMessage(message)) continue;

    const filePath = extractToolFilePath(message);
    if (!filePath || seen.has(filePath)) continue;

    seen.add(filePath);
    filePaths.push(filePath);
  }

  return { filePaths, count: filePaths.length };
}
