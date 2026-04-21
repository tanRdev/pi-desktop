export interface HighlightRange {
  start: number;
  end: number;
}

export interface FileMatch {
  filePath: string;
  lineNumber: number;
  column: number;
  lineText: string;
  highlights: HighlightRange[];
}

export interface SearchResult {
  filePath: string;
  matches: FileMatch[];
  score: number;
}

export interface SearchOptions {
  isRegex?: boolean;
  isCaseSensitive?: boolean;
  fileFilter?: string;
  maxResults?: number;
  contextLines?: number;
}

export interface ReplaceOptions {
  isRegex?: boolean;
  isCaseSensitive?: boolean;
}

const DEFAULT_MAX_RESULTS = 200;
const _DEFAULT_CONTEXT_LINES = 0;

export interface FileContent {
  filePath: string;
  content: string;
}

export function buildSearchRegex(
  pattern: string,
  options: SearchOptions,
): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  try {
    if (options.isRegex) {
      const flags = options.isCaseSensitive ? "g" : "gi";
      return new RegExp(trimmed, flags);
    }

    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flags = options.isCaseSensitive ? "g" : "gi";
    return new RegExp(escaped, flags);
  } catch {
    return null;
  }
}

export function searchInContent(
  content: string,
  pattern: string,
  options: SearchOptions,
): FileMatch[] {
  const regex = buildSearchRegex(pattern, options);
  if (!regex) return [];

  const lines = content.split("\n");
  const matches: FileMatch[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx] ?? "";
    regex.lastIndex = 0;
    const highlights: HighlightRange[] = [];
    let matchResult: RegExpExecArray | null;

    while ((matchResult = regex.exec(lineText)) !== null) {
      if (matchResult[0] === "") {
        regex.lastIndex += 1;
        continue;
      }
      highlights.push({
        start: matchResult.index,
        end: matchResult.index + matchResult[0].length,
      });
    }

    if (highlights.length > 0) {
      matches.push({
        filePath: "",
        lineNumber: lineIdx + 1,
        column: (highlights[0]?.start ?? 0) + 1,
        lineText,
        highlights,
      });
    }
  }

  return matches;
}

export function matchFileFilter(filePath: string, filter: string): boolean {
  if (!filter.trim()) return true;

  const normalizedPath = filePath.replace(/\\/g, "/");
  const patterns = filter
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const pattern of patterns) {
    if (matchGlob(normalizedPath, pattern)) {
      return true;
    }
  }

  return false;
}

function matchGlob(path: string, pattern: string): boolean {
  const normalizedPattern = pattern.replace(/\\/g, "/");

  if (!normalizedPattern.includes("*") && !normalizedPattern.includes("?")) {
    return path.endsWith(`/${normalizedPattern}`) || path === normalizedPattern;
  }

  const regexStr = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/{{GLOBSTAR}}/g, ".*");

  try {
    const regex = new RegExp(`(^|/)${regexStr}$`);
    return regex.test(path) || regex.test(path.split("/").slice(-1)[0] ?? "");
  } catch {
    return false;
  }
}

export function searchFiles(
  files: ReadonlyArray<FileContent>,
  pattern: string,
  options: SearchOptions = {},
): SearchResult[] {
  const trimmed = pattern.trim();
  if (!trimmed) return [];

  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const results: SearchResult[] = [];

  for (const file of files) {
    if (!matchFileFilter(file.filePath, options.fileFilter ?? "")) {
      continue;
    }

    const matches = searchInContent(file.content, pattern, options);
    if (matches.length === 0) continue;

    for (const match of matches) {
      match.filePath = file.filePath;
    }

    results.push({
      filePath: file.filePath,
      matches,
      score: matches.length,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.filePath.localeCompare(b.filePath);
  });

  return results.slice(0, maxResults);
}

export function computeReplaceText(
  matchText: string,
  replaceText: string,
  isRegex: boolean,
): string {
  if (!isRegex) return replaceText;

  try {
    return matchText.replace(
      new RegExp(
        matchText.startsWith("/") ? matchText.slice(1) : matchText,
        "g",
      ),
      replaceText,
    );
  } catch {
    return replaceText;
  }
}

export function replaceInContent(
  content: string,
  pattern: string,
  replaceText: string,
  options: ReplaceOptions = {},
): string {
  const regex = buildSearchRegex(pattern, {
    isRegex: options.isRegex,
    isCaseSensitive: options.isCaseSensitive,
  });
  if (!regex) return content;

  return content.replace(regex, replaceText);
}

export function getFileExtension(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  const basename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const dotIndex = basename.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return basename.slice(dotIndex + 1).toLowerCase();
}
