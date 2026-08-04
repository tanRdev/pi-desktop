import type {
  SearchMatch,
  SearchRequest,
  SearchResponse,
} from "@pi-desktop/shared";
import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";
import { createIpcContract } from "../contract-runtime.js";
import { createStrictObjectSchema } from "./helpers.js";
import {
  finiteNumberSchema,
  ipcStringSchema,
  mutableArray,
} from "./schema-primitives.js";

export const MAX_SEARCH_QUERY_BYTES = 512;
export const MAX_SEARCH_ROOT_PATH_BYTES = 4096;
export const MIN_SEARCH_RESULTS = 1;
export const MAX_SEARCH_RESULTS = 200;
export const MAX_SEARCH_PATTERN_BYTES = 512;
export const MAX_SEARCH_PATTERN_COUNT = 50;

const SEARCH_REQUEST_KEYS = new Set([
  "query",
  "rootPath",
  "maxResults",
  "includePatterns",
  "excludePatterns",
]);

const SearchPatternSchema = ipcStringSchema(MAX_SEARCH_PATTERN_BYTES);
const SearchPatternsSchema = mutableArray(SearchPatternSchema).pipe(
  Schema.filter((patterns) => patterns.length <= MAX_SEARCH_PATTERN_COUNT, {
    message: () =>
      `search patterns exceed maximum length of ${MAX_SEARCH_PATTERN_COUNT} entries`,
  }),
);

export const SearchRequestSchema = createStrictObjectSchema<SearchRequest>(
  SEARCH_REQUEST_KEYS,
  {
    query: ipcStringSchema(MAX_SEARCH_QUERY_BYTES),
    rootPath: ipcStringSchema(MAX_SEARCH_ROOT_PATH_BYTES),
    maxResults: Schema.optional(
      finiteNumberSchema().pipe(
        Schema.filter((value) => Number.isInteger(value), {
          message: () => "maxResults must be an integer",
        }),
        Schema.filter(
          (value) => value >= MIN_SEARCH_RESULTS && value <= MAX_SEARCH_RESULTS,
          {
            message: () =>
              `maxResults must be between ${MIN_SEARCH_RESULTS} and ${MAX_SEARCH_RESULTS}`,
          },
        ),
      ),
    ),
    includePatterns: Schema.optional(SearchPatternsSchema),
    excludePatterns: Schema.optional(SearchPatternsSchema),
  },
);

const SearchMatchHighlightSchema = Schema.Struct({
  start: Schema.Number,
  end: Schema.Number,
});

export const SearchMatchSchema = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  score: Schema.Number,
  type: Schema.Literal("file", "directory"),
  extension: Schema.optional(Schema.String),
  highlights: Schema.optional(mutableArray(SearchMatchHighlightSchema)),
}) satisfies Schema.Schema<SearchMatch>;

export const SearchResponseSchema = Schema.Struct({
  query: Schema.String,
  results: mutableArray(SearchMatchSchema),
  total: Schema.Number,
  duration: Schema.Number,
}) satisfies Schema.Schema<SearchResponse>;

export const searchContracts = {
  searchFiles: createIpcContract({
    channel: IPC_CHANNELS.search.searchFiles,
    request: SearchRequestSchema,
    response: SearchResponseSchema,
  }),
} as const;

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _SearchRequestAssignable = AssignableTo<
  Schema.Schema.Type<typeof SearchRequestSchema>,
  SearchRequest
>;
type _SearchResponseAssignable = AssignableTo<
  Schema.Schema.Type<typeof SearchResponseSchema>,
  SearchResponse
>;

export type SearchContractSchemasAssignable =
  | _SearchRequestAssignable
  | _SearchResponseAssignable;
