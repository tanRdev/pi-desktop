import type {
  AppPreferences,
  LegacyPreferencesImport,
  RepositoryDisplayMetadata,
  RepositoryPreferences,
  WorkspaceSession,
} from "@pi-desktop/shared";
import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";

import {
  createIpcContract,
  type NoPayloadIpcContract,
} from "../contract-runtime.js";
import { WorkspaceSessionSchema } from "../schemas.js";
import { createStrictObjectSchema } from "./helpers.js";
import {
  finiteNumberSchema,
  ipcStringSchema,
  mutableArray,
} from "./schema-primitives.js";

const nullableStringSchema = Schema.NullOr(Schema.String);

export const RepositoryDisplayMetadataSchema = Schema.Struct({
  customName: nullableStringSchema,
  icon: nullableStringSchema,
  accentColor: nullableStringSchema,
}) satisfies Schema.Schema<RepositoryDisplayMetadata>;

export const RepositoryPreferencesSchema = Schema.Struct({
  repositoryId: Schema.String,
  customName: nullableStringSchema,
  icon: nullableStringSchema,
  accentColor: nullableStringSchema,
}) satisfies Schema.Schema<RepositoryPreferences>;

export const RepositoryPreferencesNullableSchema = Schema.NullOr(
  RepositoryPreferencesSchema,
);

const RepositoryDisplayMetadataUpdatesSchema = createStrictObjectSchema<
  Partial<RepositoryDisplayMetadata>
>(
  new Set(["customName", "icon", "accentColor"]),
  {
    customName: Schema.optional(nullableStringSchema),
    icon: Schema.optional(nullableStringSchema),
    accentColor: Schema.optional(nullableStringSchema),
  },
  { acceptMissing: true },
);

export const GetRepositoryPreferencesRequestSchema = createStrictObjectSchema<{
  readonly repositoryId: string;
}>(new Set(["repositoryId"]), {
  repositoryId: ipcStringSchema(),
});

export const UpdateRepositoryPreferencesRequestSchema =
  createStrictObjectSchema<{
    readonly repositoryId: string;
    readonly updates: Partial<RepositoryDisplayMetadata>;
  }>(new Set(["repositoryId", "updates"]), {
    repositoryId: ipcStringSchema(),
    updates: RepositoryDisplayMetadataUpdatesSchema,
  });

export const GetWorkspaceSessionRequestSchema = createStrictObjectSchema<{
  readonly worktreeId: string;
}>(new Set(["worktreeId"]), {
  worktreeId: ipcStringSchema(),
});

export const WorkspaceSessionNullableSchema = Schema.NullOr(
  WorkspaceSessionSchema,
);

export const SaveWorkspaceSessionRequestSchema = createStrictObjectSchema<{
  readonly session: WorkspaceSession;
}>(new Set(["session"]), {
  session: WorkspaceSessionSchema,
});

const AiPreferencesSchema = Schema.Struct({
  provider: Schema.optional(nullableStringSchema),
  model: Schema.optional(nullableStringSchema),
});

export const AppPreferencesSchema = Schema.Struct({
  leftSidebarWidth: Schema.optional(Schema.NullOr(finiteNumberSchema())),
  ai: Schema.optional(Schema.NullOr(AiPreferencesSchema)),
  favoriteModels: Schema.optional(Schema.NullOr(mutableArray(Schema.String))),
}) satisfies Schema.Schema<AppPreferences>;

const AppPreferencesUpdatesSchema = createStrictObjectSchema<
  Partial<AppPreferences>
>(
  new Set(["leftSidebarWidth", "ai", "favoriteModels"]),
  {
    leftSidebarWidth: Schema.optional(Schema.NullOr(finiteNumberSchema())),
    ai: Schema.optional(Schema.NullOr(AiPreferencesSchema)),
    favoriteModels: Schema.optional(Schema.NullOr(mutableArray(Schema.String))),
  },
  { acceptMissing: true },
);

export const UpdateAppPreferencesRequestSchema = createStrictObjectSchema<{
  readonly updates: Partial<AppPreferences>;
}>(new Set(["updates"]), {
  updates: AppPreferencesUpdatesSchema,
});

const LegacyRepositoryPreferencesImportSchema = Schema.Struct({
  repositoryId: ipcStringSchema(),
  customName: Schema.optional(nullableStringSchema),
  icon: Schema.optional(nullableStringSchema),
  accentColor: Schema.optional(nullableStringSchema),
});

export const LegacyPreferencesImportSchema =
  createStrictObjectSchema<LegacyPreferencesImport>(
    new Set(["leftSidebarWidth", "settings", "repositories"]),
    {
      leftSidebarWidth: Schema.optional(Schema.NullOr(finiteNumberSchema())),
      settings: Schema.optional(
        Schema.NullOr(
          Schema.Record({ key: Schema.String, value: Schema.Unknown }),
        ),
      ),
      repositories: Schema.optional(
        Schema.Array(LegacyRepositoryPreferencesImportSchema),
      ),
    },
    { acceptMissing: true },
  );

export const ImportLegacyPreferencesRequestSchema = createStrictObjectSchema<{
  readonly importData: LegacyPreferencesImport;
}>(new Set(["importData"]), {
  importData: LegacyPreferencesImportSchema,
});

export const ImportLegacyPreferencesResponseSchema = Schema.Struct({
  repositoryPreferences: mutableArray(RepositoryPreferencesSchema),
  appPreferences: AppPreferencesSchema,
});

function createNoPayloadContract<TResponse>(
  channel: string,
  response: Schema.Schema<TResponse>,
): NoPayloadIpcContract<TResponse> {
  return createIpcContract({
    channel,
    request: Schema.Void,
    response,
  });
}

export const stateContracts = {
  getRepositoryPreferences: createIpcContract({
    channel: IPC_CHANNELS.state.getRepositoryPreferences,
    request: GetRepositoryPreferencesRequestSchema,
    response: RepositoryPreferencesNullableSchema,
  }),
  updateRepositoryPreferences: createIpcContract({
    channel: IPC_CHANNELS.state.updateRepositoryPreferences,
    request: UpdateRepositoryPreferencesRequestSchema,
    response: RepositoryPreferencesSchema,
  }),
  getWorkspaceSession: createIpcContract({
    channel: IPC_CHANNELS.state.getWorkspaceSession,
    request: GetWorkspaceSessionRequestSchema,
    response: WorkspaceSessionNullableSchema,
  }),
  saveWorkspaceSession: createIpcContract({
    channel: IPC_CHANNELS.state.saveWorkspaceSession,
    request: SaveWorkspaceSessionRequestSchema,
    response: WorkspaceSessionSchema,
  }),
  getAppPreferences: createNoPayloadContract(
    IPC_CHANNELS.state.getAppPreferences,
    AppPreferencesSchema,
  ),
  updateAppPreferences: createIpcContract({
    channel: IPC_CHANNELS.state.updateAppPreferences,
    request: UpdateAppPreferencesRequestSchema,
    response: AppPreferencesSchema,
  }),
  importLegacyPreferences: createIpcContract({
    channel: IPC_CHANNELS.state.importLegacyPreferences,
    request: ImportLegacyPreferencesRequestSchema,
    response: ImportLegacyPreferencesResponseSchema,
  }),
} as const;

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _RepositoryPreferencesAssignable = AssignableTo<
  Schema.Schema.Type<typeof RepositoryPreferencesSchema>,
  RepositoryPreferences
>;
type _AppPreferencesAssignable = AssignableTo<
  Schema.Schema.Type<typeof AppPreferencesSchema>,
  AppPreferences
>;
type _WorkspaceSessionAssignable = AssignableTo<
  Schema.Schema.Type<typeof WorkspaceSessionSchema>,
  WorkspaceSession
>;

export type StateContractSchemasAssignable =
  | _RepositoryPreferencesAssignable
  | _AppPreferencesAssignable
  | _WorkspaceSessionAssignable;

export const stateContractList = [
  stateContracts.getRepositoryPreferences,
  stateContracts.updateRepositoryPreferences,
  stateContracts.getWorkspaceSession,
  stateContracts.saveWorkspaceSession,
  stateContracts.getAppPreferences,
  stateContracts.updateAppPreferences,
  stateContracts.importLegacyPreferences,
] as const;
