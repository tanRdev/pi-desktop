export type PromptAutocompleteTrigger = "/" | "@";

export interface PromptAutocompleteMatch {
  trigger: PromptAutocompleteTrigger;
  query: string;
  start: number;
  end: number;
}

const AUTOCOMPLETE_PATTERN = /(^|\s)([@/])([^\s]*)$/;
const TERMINAL_MENTION_PATTERN = /@terminal:([^\s]+)/g;
const FILE_MENTION_PATTERN = /@file:([^\s]+)/g;

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
  return text.replace(FILE_MENTION_PATTERN, (_match, encodedPath: string) =>
    decodeMentionValue(encodedPath),
  );
}
