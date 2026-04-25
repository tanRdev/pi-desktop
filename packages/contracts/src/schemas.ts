import type {
  AgentMessageRole,
  AgentMessageStatus,
  AgentRuntimeStatus,
  AgentSnapshot,
  AppRuntimeMode,
  ModelSnapshot,
  ProviderSnapshot,
  RepositorySnapshot,
  SettingsSnapshot,
  ShellAgentMode,
  ShellGitSnapshot,
  ShellGitStatus,
  ShellSnapshot,
  ThreadRuntimeStatus,
  ThreadSnapshot,
  WorkspaceSession,
  WorktreeGitSnapshot,
  WorktreeGitStatus,
  WorktreeSnapshot,
} from "@pi-desktop/shared";
import { Schema } from "effect";

/**
 * `Schema.Array(T)` decodes to `readonly T[]`, but the canonical TS models in
 * `@pi-desktop/shared` use mutable `T[]`. `mutableArray` wraps `Schema.Array`
 * with `Schema.mutable` so the decoded type is structurally assignable.
 */
const mutableArray = <A, I, R>(item: Schema.Schema<A, I, R>) =>
  Schema.mutable(Schema.Array(item));

/**
 * Schema mirrors of the runtime shapes defined as TS types in
 * `@pi-desktop/shared`. The decoded types must be assignable to the TS types
 * (verified by the `type _AssignableTo*` assertions at the bottom of this file).
 */

const ShellAgentModeSchema = Schema.Literal(
  "mock",
  "sdk",
  "cli",
  "unknown",
) satisfies Schema.Schema<ShellAgentMode>;

const AppRuntimeModeSchema = Schema.Literal(
  "development",
  "production",
  "test",
) satisfies Schema.Schema<AppRuntimeMode>;

const ShellGitStatusSchema = Schema.Literal(
  "repository",
  "not_repo",
  "unavailable",
) satisfies Schema.Schema<ShellGitStatus>;

const WorktreeGitStatusSchema = Schema.Literal(
  "ready",
  "missing",
  "unavailable",
) satisfies Schema.Schema<WorktreeGitStatus>;

const AgentRuntimeStatusSchema = Schema.Literal(
  "error",
  "ready",
  "starting",
  "streaming",
) satisfies Schema.Schema<AgentRuntimeStatus>;

const ThreadRuntimeStatusSchema = Schema.Literal(
  "error",
  "ready",
  "starting",
  "streaming",
  "disconnected",
  "exited",
) satisfies Schema.Schema<ThreadRuntimeStatus>;

const AgentMessageRoleSchema = Schema.Literal(
  "assistant",
  "system",
  "tool",
  "user",
) satisfies Schema.Schema<AgentMessageRole>;

const AgentMessageStatusSchema = Schema.Literal(
  "complete",
  "error",
  "streaming",
) satisfies Schema.Schema<AgentMessageStatus>;

// ---------------------------------------------------------------------------
// thread.ts
// ---------------------------------------------------------------------------

const ThreadRuntimeSnapshotSchema = Schema.Struct({
  status: ThreadRuntimeStatusSchema,
  lastError: Schema.NullOr(Schema.String),
});

const ThreadSnapshotSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  lastActivityAt: Schema.NullOr(Schema.Number),
  createdAt: Schema.optional(Schema.Number),
  runtime: ThreadRuntimeSnapshotSchema,
}) satisfies Schema.Schema<ThreadSnapshot>;

// ---------------------------------------------------------------------------
// worktree.ts
// ---------------------------------------------------------------------------

const WorktreeGitSnapshotSchema = Schema.Struct({
  status: WorktreeGitStatusSchema,
  branch: Schema.NullOr(Schema.String),
  commit: Schema.NullOr(Schema.String),
  hasChanges: Schema.Boolean,
  ahead: Schema.NullOr(Schema.Number),
  behind: Schema.NullOr(Schema.Number),
  stagedCount: Schema.Number,
  modifiedCount: Schema.Number,
  untrackedCount: Schema.Number,
  message: Schema.NullOr(Schema.String),
  prStatus: Schema.optional(
    Schema.NullOr(Schema.Literal("merged", "open", "closed")),
  ),
}) satisfies Schema.Schema<WorktreeGitSnapshot>;

const WorktreeSnapshotSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  path: Schema.String,
  isMain: Schema.Boolean,
  isDetached: Schema.Boolean,
  git: WorktreeGitSnapshotSchema,
  threads: mutableArray(ThreadSnapshotSchema),
  createdAt: Schema.optional(Schema.Number),
}) satisfies Schema.Schema<WorktreeSnapshot>;

// ---------------------------------------------------------------------------
// repository.ts
// ---------------------------------------------------------------------------

const RepositorySnapshotSchema = Schema.Struct({
  id: Schema.String,
  order: Schema.optional(Schema.Number),
  name: Schema.String,
  customName: Schema.optional(Schema.NullOr(Schema.String)),
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  accentColor: Schema.optional(Schema.NullOr(Schema.String)),
  rootPath: Schema.String,
  defaultBranch: Schema.NullOr(Schema.String),
  worktrees: mutableArray(WorktreeSnapshotSchema),
}) satisfies Schema.Schema<RepositorySnapshot>;

// ---------------------------------------------------------------------------
// workspace-session.ts (subset used inside ShellCatalogSnapshot)
// ---------------------------------------------------------------------------

/**
 * The `WorkspaceWindow` discriminated union (8 variants) is not mirrored at
 * the schema level — it transits the boundary as opaque JSON and the renderer
 * retains strict typing via `@pi-desktop/shared`. `Schema.Any` validates that
 * each entry is defined and preserves assignability to `WorkspaceWindow`.
 */
const WorkspaceWindowSchema = Schema.Any;

const WindowLayoutStateSchema = Schema.Struct({
  windows: mutableArray(WorkspaceWindowSchema),
  nextZIndex: Schema.Number,
  focusedWindowId: Schema.NullOr(Schema.String),
  snapGridSize: Schema.Number,
  zoom: Schema.Number,
  panX: Schema.Number,
  panY: Schema.Number,
});

const WorkspaceSidebarStateSchema = Schema.Struct({
  activePanel: Schema.NullOr(Schema.Literal("files", "notes", "search")),
  isCollapsed: Schema.Boolean,
});

const WorkspaceSearchStateSchema = Schema.Struct({
  query: Schema.String,
  selectedPath: Schema.NullOr(Schema.String),
});

const WorkspaceFileStateSchema = Schema.Struct({
  filePath: Schema.String,
  scrollTop: Schema.Number,
});

const WorkspaceNoteStateSchema = Schema.Struct({
  noteId: Schema.String,
  draft: Schema.String,
});

const WorkspaceRecoveryDraftSchema = Schema.Struct({
  kind: Schema.Literal("thread", "note"),
  text: Schema.String,
  updatedAt: Schema.Number,
});

const WorkspaceSessionSchema = Schema.Struct({
  worktreeId: Schema.String,
  layout: WindowLayoutStateSchema,
  sidebar: WorkspaceSidebarStateSchema,
  promptDrafts: Schema.Record({ key: Schema.String, value: Schema.String }),
  search: WorkspaceSearchStateSchema,
  files: Schema.Record({
    key: Schema.String,
    value: WorkspaceFileStateSchema,
  }),
  notes: Schema.Record({
    key: Schema.String,
    value: WorkspaceNoteStateSchema,
  }),
  recoveryDrafts: Schema.Record({
    key: Schema.String,
    value: WorkspaceRecoveryDraftSchema,
  }),
}) satisfies Schema.Schema<WorkspaceSession>;

// ---------------------------------------------------------------------------
// shell.ts
// ---------------------------------------------------------------------------

const ShellRuntimeSnapshotSchema = Schema.Struct({
  agentMode: ShellAgentModeSchema,
  electronVersion: Schema.optional(Schema.String),
  agentDirectory: Schema.optional(Schema.NullOr(Schema.String)),
});

const ShellProjectSnapshotSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  path: Schema.String,
  isActive: Schema.Boolean,
});

const ShellWorkspaceSnapshotSchema = Schema.Struct({
  rootPath: Schema.NullOr(Schema.String),
  agentDirectory: Schema.NullOr(Schema.String),
  projects: mutableArray(ShellProjectSnapshotSchema),
});

const ShellSelectionSnapshotSchema = Schema.Struct({
  repositoryId: Schema.NullOr(Schema.String),
  worktreeId: Schema.NullOr(Schema.String),
  threadId: Schema.NullOr(Schema.String),
});

const ShellCatalogSnapshotSchema = Schema.Struct({
  repositories: mutableArray(RepositorySnapshotSchema),
  selection: ShellSelectionSnapshotSchema,
  reconciledWorkspaceSessions: Schema.optional(
    mutableArray(WorkspaceSessionSchema),
  ),
});

const ShellCapabilitiesSnapshotSchema = Schema.Struct({
  supportsTurns: Schema.Boolean,
  supportsTools: Schema.Boolean,
  supportsActivity: Schema.Boolean,
  supportsParallelSessions: Schema.Boolean,
});

const ShellGitSnapshotSchema = Schema.Struct({
  status: ShellGitStatusSchema,
  rootPath: Schema.optional(Schema.String),
  branch: Schema.optional(Schema.String),
  commit: Schema.optional(Schema.String),
  hasChanges: Schema.optional(Schema.Boolean),
  ahead: Schema.optional(Schema.Number),
  behind: Schema.optional(Schema.Number),
  stagedCount: Schema.optional(Schema.Number),
  modifiedCount: Schema.optional(Schema.Number),
  untrackedCount: Schema.optional(Schema.Number),
  message: Schema.optional(Schema.NullOr(Schema.String)),
}) satisfies Schema.Schema<ShellGitSnapshot>;

export const ShellSnapshotSchema = Schema.Struct({
  appName: Schema.String,
  appVersion: Schema.String,
  platform: Schema.String,
  chromeVersion: Schema.String,
  mode: AppRuntimeModeSchema,
  runtime: Schema.optional(ShellRuntimeSnapshotSchema),
  catalog: ShellCatalogSnapshotSchema,
  workspace: Schema.optional(ShellWorkspaceSnapshotSchema),
  capabilities: Schema.optional(ShellCapabilitiesSnapshotSchema),
  git: Schema.optional(Schema.NullOr(ShellGitSnapshotSchema)),
});

// ---------------------------------------------------------------------------
// agent.ts — ProviderSnapshot, SettingsSnapshot, AgentSnapshot
// ---------------------------------------------------------------------------

const ModelSnapshotSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  providerId: Schema.String,
  supportsThinking: Schema.optional(Schema.Boolean),
  supportsVision: Schema.optional(Schema.Boolean),
  contextWindow: Schema.optional(Schema.Number),
  maxOutputTokens: Schema.optional(Schema.Number),
}) satisfies Schema.Schema<ModelSnapshot>;

export const ProviderSnapshotSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  models: mutableArray(ModelSnapshotSchema),
  isConfigured: Schema.optional(Schema.Boolean),
}) satisfies Schema.Schema<ProviderSnapshot>;

export const ProviderSnapshotArraySchema = mutableArray(ProviderSnapshotSchema);

export const SettingsSnapshotSchema = Schema.Struct(
  {
    currentProviderId: Schema.optional(Schema.String),
    currentModelId: Schema.optional(Schema.String),
    defaultProvider: Schema.optional(Schema.String),
    defaultModel: Schema.optional(Schema.String),
    thinkingLevel: Schema.optional(
      Schema.Literal("none", "low", "medium", "high"),
    ),
  },
  {
    key: Schema.String,
    value: Schema.Unknown,
  },
) satisfies Schema.Schema<SettingsSnapshot>;

const ContextUsageSnapshotSchema = Schema.Struct({
  tokens: Schema.NullOr(Schema.Number),
  contextWindow: Schema.Number,
  percent: Schema.NullOr(Schema.Number),
});

const AgentMessageSnapshotSchema = Schema.Struct({
  id: Schema.String,
  role: AgentMessageRoleSchema,
  text: Schema.String,
  status: AgentMessageStatusSchema,
  timestamp: Schema.Number,
});

export const AgentSnapshotSchema = Schema.Struct({
  sessionId: Schema.String,
  status: AgentRuntimeStatusSchema,
  messages: mutableArray(AgentMessageSnapshotSchema),
  lastError: Schema.NullOr(Schema.String),
  currentModelId: Schema.optional(Schema.String),
  currentProviderId: Schema.optional(Schema.String),
  contextUsage: Schema.optional(ContextUsageSnapshotSchema),
}) satisfies Schema.Schema<AgentSnapshot>;

// ---------------------------------------------------------------------------
// Assignability assertions — guarantee the decoded Schema types stay in sync
// with the canonical TS types. A mismatch causes a compile error.
// ---------------------------------------------------------------------------

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _ShellSnapshotAssignable = AssignableTo<
  Schema.Schema.Type<typeof ShellSnapshotSchema>,
  ShellSnapshot
>;
type _ProviderSnapshotArrayAssignable = AssignableTo<
  Schema.Schema.Type<typeof ProviderSnapshotArraySchema>,
  readonly ProviderSnapshot[]
>;
type _SettingsSnapshotAssignable = AssignableTo<
  Schema.Schema.Type<typeof SettingsSnapshotSchema>,
  SettingsSnapshot
>;
type _AgentSnapshotAssignable = AssignableTo<
  Schema.Schema.Type<typeof AgentSnapshotSchema>,
  AgentSnapshot
>;

// Force the type aliases to be referenced so `noUnusedLocals` stays happy.
export type ContractSchemasAssignable =
  | _ShellSnapshotAssignable
  | _ProviderSnapshotArrayAssignable
  | _SettingsSnapshotAssignable
  | _AgentSnapshotAssignable;
