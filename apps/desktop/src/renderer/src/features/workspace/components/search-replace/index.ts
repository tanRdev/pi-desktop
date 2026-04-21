export type {
  FileContent,
  FileMatch,
  HighlightRange,
  ReplaceOptions,
  SearchOptions,
  SearchResult,
} from "./search-engine";
export {
  buildSearchRegex,
  computeReplaceText,
  getFileExtension,
  matchFileFilter,
  replaceInContent,
  searchFiles,
  searchInContent,
} from "./search-engine";
export {
  SearchReplaceHost,
  type SearchReplaceHostProps,
} from "./search-replace-host";
export {
  SearchReplacePanel,
  type SearchReplacePanelProps,
} from "./search-replace-panel";
