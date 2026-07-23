import type {
  SearchMatch,
  SearchRequest,
  SearchResponse,
} from "@pi-desktop/shared";
import { IPC_CHANNELS } from "@pi-desktop/shared";
import { Schema } from "effect";
import { createIpcContract } from "../contract-runtime.js";
import { createStrictObjectSchema } from "./helpers.js";
import { mutableArray } from "./schema-primitives.js";

const SEARCH_REQUEST_KEYS = new Set([
  "query",
  "rootPath",
  "maxResults",
  "includePatterns",
  "excludePatterns",
]);

export const SearchRequestSchema = createStrictObjectSchema<SearchRequest>(
  SEARCH_REQUEST_KEYS,
  {
    query: Schema.String,
    rootPath: Schema.String,
    maxResults: Schema.optional(Schema.Number),
    includePatterns: Schema.optional(mutableArray(Schema.String)),
    excludePatterns: Schema.optional(mutableArray(Schema.String)),
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
