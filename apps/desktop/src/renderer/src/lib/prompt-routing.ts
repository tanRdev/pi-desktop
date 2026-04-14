import type { MentionSuggestion, SearchMatch } from "@pi-desktop/shared";

export type PromptAutocompleteTrigger = "/" | "@";

export interface PromptAutocompleteMatch {
  trigger: PromptAutocompleteTrigger;
  query: string;
  start: number;
  end: number;
}

const AUTOCOMPLETE_PATTERN = /(^|\s)([@/])([^\s]*)$/;
const TERMINAL_MENTION_PATTERN = /@terminal:([^\s]+)/g;
// capture optional trailing whitespace so expansion normalizes spacing
const FILE_MENTION_PATTERN = /@file:([^\s]+)(\s*)/g;

export function getPromptAutocompleteMatch(
  text: string,
): PromptAutocompleteMatch | null {
  const match = AUTOCOMPLETE_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const prefix = match[1] ?? "";
  const trigger = match[2];
  const query = match[3] ?? "";
  const start = match.index + prefix.length;

  if (trigger !== "/" && trigger !== "@") {
    return null;
  }

  return {
    trigger,
    query,
    start,
    end: text.length,
  };
}

export function replacePromptToken(
  text: string,
  match: PromptAutocompleteMatch,
  replacement: string,
): string {
  return `${text.slice(0, match.start)}${replacement}${text.slice(match.end)}`;
}

export function encodeMentionValue(value: string): string {
  return encodeURIComponent(value);
}

export function decodeMentionValue(value: string): string {
  return decodeURIComponent(value);
}

export function buildTerminalMention(terminalId: string): string {
  return `@terminal:${encodeMentionValue(terminalId)} `;
}

export function buildFileMention(filePath: string): string {
  return `@file:${encodeMentionValue(filePath)} `;
}

export function extractTerminalRoute(text: string): {
  terminalIds: string[];
  prompt: string;
} {
  const terminalIds = [...text.matchAll(TERMINAL_MENTION_PATTERN)].map(
    (match) => decodeMentionValue(match[1] ?? ""),
  );
  const prompt = text.replace(TERMINAL_MENTION_PATTERN, "").trim();

  return {
    terminalIds,
    prompt,
  };
}

export function expandFileMentions(text: string): string {
  const replaced = text.replace(
    FILE_MENTION_PATTERN,
    (_match: string, encodedPath?: string, trailing?: string) =>
      decodeMentionValue(encodedPath ?? "") + (trailing ? " " : ""),
  );

  // Collapse any runs of whitespace into a single space and trim edges. This
  // ensures predictable spacing when mentions are adjacent to template
  // spaces or when multiple mentions are present.
  return replaced.replace(/\s+/g, " ").trim();
}

export type PlanPromptDispatchArgs = {
  draft: string;
  canSend: boolean;
  activeThreadId: string | null;
};

export type PlanPromptDispatchResult =
  | { action: "noop" }
  | { action: "send"; threadId: string; nextDraft: string }
  | { action: "route"; terminalId: string; prompt: string; nextDraft: string };

export function planPromptDispatch({
  draft,
  canSend,
  activeThreadId,
}: PlanPromptDispatchArgs): PlanPromptDispatchResult {
  if (!canSend) return { action: "noop" };
  if (!activeThreadId) return { action: "noop" };

  const expandedPrompt = expandFileMentions(draft);
  const routedPrompt = extractTerminalRoute(expandedPrompt);

  if (routedPrompt.terminalIds.length > 0) {
    const terminalId = routedPrompt.terminalIds[0];
    const remainingPrompt = routedPrompt.prompt.trim();
    if (!terminalId || !remainingPrompt) return { action: "noop" };

    return {
      action: "route",
      terminalId,
      prompt: remainingPrompt,
      nextDraft: "",
    };
  }

  return {
    action: "send",
    threadId: activeThreadId,
    nextDraft: expandedPrompt,
  };
}

type WindowLike = {
  kind: string;
  title?: string;
  linkColor?: string;
  terminalId?: string;
  cwd?: string;
  repositoryPath?: string;
  filePath?: string;
};

type FileSearchResult = Pick<SearchMatch, "type" | "path" | "name">;

function matchesMentionQuery(
  name: string,
  context: string | undefined,
  query: string,
): boolean {
  if (query.length === 0) {
    return true;
  }

  const normalizedName = name.toLowerCase();
  const normalizedContext = context?.toLowerCase();

  return (
    normalizedName.includes(query) ||
    normalizedContext?.includes(query) === true
  );
}

function pushMentionSuggestion(
  suggestions: MentionSuggestion[],
  seen: Set<string>,
  suggestion: MentionSuggestion,
) {
  const key = `${suggestion.kind}:${suggestion.id}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  suggestions.push(suggestion);
}

export function buildMentionSuggestions({
  windows,
  fileSearchResults = [],
  query,
}: {
  windows: WindowLike[];
  fileSearchResults?: FileSearchResult[];
  query: string;
}): MentionSuggestion[] {
  const normalizedQuery = query.trim().toLowerCase();
  const suggestions: MentionSuggestion[] = [];
  const seen = new Set<string>();

  for (const window of windows) {
    if (window.kind === "terminal" && window.terminalId) {
      const suggestion: MentionSuggestion = {
        kind: "terminal",
        id: window.terminalId,
        name: window.title ?? window.terminalId,
        context: window.cwd,
        linkColor: window.linkColor,
      };

      if (
        matchesMentionQuery(
          suggestion.name,
          suggestion.context,
          normalizedQuery,
        )
      ) {
        pushMentionSuggestion(suggestions, seen, suggestion);
      }
      continue;
    }

    if (window.kind === "git" && window.terminalId) {
      const suggestion: MentionSuggestion = {
        kind: "terminal",
        id: window.terminalId,
        name: window.title ?? window.terminalId,
        context: window.repositoryPath,
        linkColor: window.linkColor,
      };

      if (
        matchesMentionQuery(
          suggestion.name,
          suggestion.context,
          normalizedQuery,
        )
      ) {
        pushMentionSuggestion(suggestions, seen, suggestion);
      }
      continue;
    }

    if (window.kind === "file" && window.filePath) {
      const suggestion: MentionSuggestion = {
        kind: "file",
        id: window.filePath,
        name: window.title ?? window.filePath,
        context: window.filePath,
      };

      if (
        matchesMentionQuery(
          suggestion.name,
          suggestion.context,
          normalizedQuery,
        )
      ) {
        pushMentionSuggestion(suggestions, seen, suggestion);
      }
    }
  }

  for (const match of fileSearchResults) {
    if (match.type !== "file") {
      continue;
    }

    const suggestion: MentionSuggestion = {
      kind: "file",
      id: match.path,
      name: match.name,
      context: match.path,
    };

    if (
      matchesMentionQuery(suggestion.name, suggestion.context, normalizedQuery)
    ) {
      pushMentionSuggestion(suggestions, seen, suggestion);
    }
  }

  return suggestions;
}
