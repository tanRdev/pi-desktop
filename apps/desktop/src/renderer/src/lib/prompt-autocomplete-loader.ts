import type {
  MentionSuggestion,
  SearchMatch,
  SlashSuggestion,
} from "@pidesk/shared";
import {
  buildMentionSuggestions,
  type PromptAutocompleteMatch,
} from "./prompt-routing";

type WindowLike = Parameters<
  typeof buildMentionSuggestions
>[0]["windows"][number];

export async function loadPromptAutocompleteSuggestions({
  draft,
  autocompleteMatch,
  activeWorktreePath,
  windows,
  getSlashSuggestions,
  searchFiles,
}: {
  draft: string;
  autocompleteMatch: PromptAutocompleteMatch;
  activeWorktreePath: string | null;
  windows: WindowLike[];
  getSlashSuggestions: (args: {
    text: string;
    cursorPosition: number;
    trigger: "/";
    query: string;
  }) => Promise<{ suggestions: (SlashSuggestion | MentionSuggestion)[] }>;
  searchFiles: (args: {
    query: string;
    rootPath: string;
    maxResults: number;
  }) => Promise<{ results: SearchMatch[] }>;
}): Promise<(SlashSuggestion | MentionSuggestion)[]> {
  if (autocompleteMatch.trigger === "/") {
    const response = await getSlashSuggestions({
      text: draft,
      cursorPosition: draft.length,
      trigger: "/",
      query: autocompleteMatch.query,
    });
    return response.suggestions;
  }

  let fileSearchResults: SearchMatch[] = [];
  if (activeWorktreePath) {
    try {
      const searchResponse = await searchFiles({
        query: autocompleteMatch.query.trim(),
        rootPath: activeWorktreePath,
        maxResults: 8,
      });
      fileSearchResults = searchResponse.results;
    } catch {
      fileSearchResults = [];
    }
  }

  return buildMentionSuggestions({
    windows,
    fileSearchResults,
    query: autocompleteMatch.query,
  });
}
