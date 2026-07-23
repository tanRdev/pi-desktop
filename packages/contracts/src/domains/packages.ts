import type {
  InstalledPackageSnapshot,
  PackageCatalogDetail,
  PackageCatalogItem,
  PackageInstallRequest,
  PackageInstallScope,
  PackageManagerStatus,
  PackageOperationSnapshot,
  PackageRemoveRequest,
  PackageSearchRequest,
  PackageSearchResponse,
  PackagesEvent,
  PackageUpdateRequest,
} from "@pi-desktop/shared";
import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";

import {
  createIpcContract,
  createIpcEventContract,
  type NoPayloadIpcContract,
} from "../contract-runtime.js";
import { createStrictObjectSchema } from "./helpers.js";
import { ipcStringSchema, mutableArray } from "./schema-primitives.js";

const PackageKindSchema = Schema.Literal(
  "extension",
  "skill",
  "theme",
  "prompt",
);

const PackageSortSchema = Schema.Literal("downloads", "recent", "name");

const PackageInstallScopeSchema = Schema.Literal("global", "local");

const PackageManagerCapabilitySchema = Schema.Literal(
  "available",
  "unavailable",
);

const PackageOperationKindSchema = Schema.Literal(
  "install",
  "remove",
  "update",
  "refresh",
);

const PackageOperationStatusSchema = Schema.Literal(
  "queued",
  "running",
  "succeeded",
  "failed",
);

const SEARCH_REQUEST_KEYS = new Set(["query", "sort", "kinds", "hasDemoOnly"]);
const PACKAGE_NAME_KEYS = new Set(["packageName"]);
const LIST_INSTALLED_KEYS = new Set(["scope"]);
const INSTALL_REQUEST_KEYS = new Set(["packageName", "scope"]);
const REMOVE_REQUEST_KEYS = new Set(["packageName", "scope"]);
const UPDATE_REQUEST_KEYS = new Set(["packageName", "scope"]);

export const PackageSearchRequestSchema =
  createStrictObjectSchema<PackageSearchRequest>(SEARCH_REQUEST_KEYS, {
    query: ipcStringSchema(),
    sort: PackageSortSchema,
    kinds: mutableArray(PackageKindSchema),
    hasDemoOnly: Schema.optional(Schema.Boolean),
  });

export const PackageGetDetailRequestSchema = createStrictObjectSchema<{
  readonly packageName: string;
}>(PACKAGE_NAME_KEYS, {
  packageName: ipcStringSchema(),
});

export const PackageListInstalledRequestSchema = createStrictObjectSchema<{
  readonly scope?: PackageInstallScope;
}>(LIST_INSTALLED_KEYS, {
  scope: Schema.optional(PackageInstallScopeSchema),
});

export const PackageInstallRequestSchema =
  createStrictObjectSchema<PackageInstallRequest>(INSTALL_REQUEST_KEYS, {
    packageName: ipcStringSchema(),
    scope: PackageInstallScopeSchema,
  });

export const PackageRemoveRequestSchema =
  createStrictObjectSchema<PackageRemoveRequest>(REMOVE_REQUEST_KEYS, {
    packageName: ipcStringSchema(),
    scope: PackageInstallScopeSchema,
  });

export const PackageUpdateRequestSchema =
  createStrictObjectSchema<PackageUpdateRequest>(UPDATE_REQUEST_KEYS, {
    packageName: Schema.optional(ipcStringSchema()),
    scope: PackageInstallScopeSchema,
  });

export const PackageManagerStatusSchema = Schema.Struct({
  cli: PackageManagerCapabilitySchema,
  network: PackageManagerCapabilitySchema,
  authenticated: Schema.Boolean,
  message: Schema.NullOr(Schema.String),
}) satisfies Schema.Schema<PackageManagerStatus>;

export const PackageCatalogItemSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.String,
  downloads: Schema.Number,
  publishedAt: Schema.NullOr(Schema.String),
  kinds: mutableArray(PackageKindSchema),
  author: Schema.NullOr(Schema.String),
  maintainers: mutableArray(Schema.String),
  repositoryUrl: Schema.NullOr(Schema.String),
  npmUrl: Schema.String,
  readmeUrl: Schema.NullOr(Schema.String),
  hasDemo: Schema.Boolean,
  demoVideoUrl: Schema.NullOr(Schema.String),
  demoImageUrl: Schema.NullOr(Schema.String),
}) satisfies Schema.Schema<PackageCatalogItem>;

export const PackageCatalogDetailSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  description: Schema.String,
  downloads: Schema.Number,
  publishedAt: Schema.NullOr(Schema.String),
  kinds: mutableArray(PackageKindSchema),
  author: Schema.NullOr(Schema.String),
  maintainers: mutableArray(Schema.String),
  repositoryUrl: Schema.NullOr(Schema.String),
  npmUrl: Schema.String,
  readmeUrl: Schema.NullOr(Schema.String),
  hasDemo: Schema.Boolean,
  demoVideoUrl: Schema.NullOr(Schema.String),
  demoImageUrl: Schema.NullOr(Schema.String),
  keywords: mutableArray(Schema.String),
  readmeMarkdown: Schema.NullOr(Schema.String),
  installCommand: Schema.String,
}) satisfies Schema.Schema<PackageCatalogDetail>;

export const PackageSearchResponseSchema = Schema.Struct({
  query: Schema.String,
  sort: PackageSortSchema,
  total: Schema.Number,
  packages: mutableArray(PackageCatalogItemSchema),
}) satisfies Schema.Schema<PackageSearchResponse>;

export const InstalledPackageSnapshotSchema = Schema.Struct({
  source: Schema.String,
  name: Schema.String,
  version: Schema.NullOr(Schema.String),
  scope: PackageInstallScopeSchema,
  installPath: Schema.NullOr(Schema.String),
  isPinned: Schema.Boolean,
}) satisfies Schema.Schema<InstalledPackageSnapshot>;

export const InstalledPackageSnapshotArraySchema = mutableArray(
  InstalledPackageSnapshotSchema,
);

export const PackageOperationSnapshotSchema = Schema.Struct({
  id: Schema.String,
  packageName: Schema.String,
  scope: PackageInstallScopeSchema,
  kind: PackageOperationKindSchema,
  status: PackageOperationStatusSchema,
  message: Schema.NullOr(Schema.String),
  output: mutableArray(Schema.String),
}) satisfies Schema.Schema<PackageOperationSnapshot>;

const PackageOperationUpdatedEventSchema = Schema.Struct({
  type: Schema.Literal("operation_updated"),
  operation: PackageOperationSnapshotSchema,
});

const PackageInstalledStateChangedEventSchema = Schema.Struct({
  type: Schema.Literal("installed_state_changed"),
  scope: PackageInstallScopeSchema,
  installed: InstalledPackageSnapshotArraySchema,
});

export const PackagesEventSchema = Schema.Union(
  PackageOperationUpdatedEventSchema,
  PackageInstalledStateChangedEventSchema,
) satisfies Schema.Schema<PackagesEvent>;

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

export const packagesContracts = {
  getManagerStatus: createNoPayloadContract(
    IPC_CHANNELS.packages.getManagerStatus,
    PackageManagerStatusSchema,
  ),
  searchCatalog: createIpcContract({
    channel: IPC_CHANNELS.packages.searchCatalog,
    request: PackageSearchRequestSchema,
    response: PackageSearchResponseSchema,
  }),
  getPackageDetail: createIpcContract({
    channel: IPC_CHANNELS.packages.getPackageDetail,
    request: PackageGetDetailRequestSchema,
    response: PackageCatalogDetailSchema,
  }),
  listInstalled: createIpcContract({
    channel: IPC_CHANNELS.packages.listInstalled,
    request: PackageListInstalledRequestSchema,
    response: InstalledPackageSnapshotArraySchema,
  }),
  install: createIpcContract({
    channel: IPC_CHANNELS.packages.install,
    request: PackageInstallRequestSchema,
    response: PackageOperationSnapshotSchema,
  }),
  remove: createIpcContract({
    channel: IPC_CHANNELS.packages.remove,
    request: PackageRemoveRequestSchema,
    response: PackageOperationSnapshotSchema,
  }),
  update: createIpcContract({
    channel: IPC_CHANNELS.packages.update,
    request: PackageUpdateRequestSchema,
    response: PackageOperationSnapshotSchema,
  }),
  event: createIpcEventContract({
    channel: IPC_CHANNELS.packages.event,
    payload: PackagesEventSchema,
  }),
} as const;

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _PackagesEventAssignable = AssignableTo<
  Schema.Schema.Type<typeof PackagesEventSchema>,
  PackagesEvent
>;
type _PackageSearchRequestAssignable = AssignableTo<
  Schema.Schema.Type<typeof PackageSearchRequestSchema>,
  PackageSearchRequest
>;
type _PackageSearchResponseAssignable = AssignableTo<
  Schema.Schema.Type<typeof PackageSearchResponseSchema>,
  PackageSearchResponse
>;

export type PackagesContractSchemasAssignable =
  | _PackagesEventAssignable
  | _PackageSearchRequestAssignable
  | _PackageSearchResponseAssignable;

export const packagesContractList = [
  packagesContracts.getManagerStatus,
  packagesContracts.searchCatalog,
  packagesContracts.getPackageDetail,
  packagesContracts.listInstalled,
  packagesContracts.install,
  packagesContracts.remove,
  packagesContracts.update,
  packagesContracts.event,
] as const;
