/**
 * Search request/response types for fff-backed fuzzy file search.
 */

/**
 * Search request options.
 */
export interface SearchRequest {
  /** Search query */
  query: string;
  /** Root directory to search */
  rootPath: string;
  /** Maximum results to return */
  maxResults?: number;
  /** File patterns to include (glob) */
  includePatterns?: string[];
  /** File patterns to exclude (glob) */
  excludePatterns?: string[];
}

/**
 * Search result item.
 */
export interface SearchMatch {
  /** File path (absolute) */
  path: string;
  /** File name */
  name: string;
  /** Match score (higher = better) */
  score: number;
  /** File type */
  type: "file" | "directory";
  /** File extension */
  extension?: string;
  /** Match highlights (character ranges) */
  highlights?: Array<{ start: number; end: number }>;
}

/**
 * Search response.
 */
export interface SearchResponse {
  /** Original query */
  query: string;
  /** Search results */
  results: SearchMatch[];
  /** Total results found (may be more than returned) */
  total: number;
  /** Search duration in ms */
  duration: number;
}

/**
 * Skill/command suggestion for slash autocomplete.
 */
export interface SlashSuggestion {
  /** Suggestion kind */
  kind: "skill" | "command" | "prompt" | "model";
  /** Display name */
  name: string;
  /** Full slash command (e.g., "/skill:brainstorming") */
  slash: string;
  /** Description */
  description?: string;
  /** Source location */
  source?: string;
}

/**
 * Mention suggestion for @ autocomplete.
 */
export interface MentionSuggestion {
  /** Suggestion kind */
  kind: "file" | "terminal" | "thread";
  /** Display name */
  name: string;
  /** ID for routing */
  id: string;
  /** Additional context */
  context?: string;
  /** Link color (for terminals/threads) */
  linkColor?: string;
}

/**
 * Autocomplete context.
 */
export interface AutocompleteContext {
  /** Current text before cursor */
  text: string;
  /** Cursor position in text */
  cursorPosition: number;
  /** Trigger character ("/" or "@") */
  trigger?: "/" | "@";
  /** Query after trigger */
  query: string;
}

/**
 * Autocomplete suggestions response.
 */
export interface AutocompleteSuggestions {
  /** Suggestion kind */
  kind: "slash" | "mention";
  /** Matching suggestions */
  suggestions: (SlashSuggestion | MentionSuggestion)[];
  /** Whether there are more results */
  hasMore: boolean;
}
