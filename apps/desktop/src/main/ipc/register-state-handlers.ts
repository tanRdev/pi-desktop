import {
  type AppPreferences,
  IPC_CHANNELS,
  type LegacyPreferencesImport,
  type RepositoryDisplayMetadata,
  type RepositoryPreferences,
  type WorkspaceSession,
} from "@pi-desktop/shared";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";
import { sanitizeWorkspaceSession } from "../workspace-session-catalog";
import { getNumberField, getStringField } from "./payload-parsers";

type RegisterStateHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "stateHost"
>;

function getRecordField(
  payload: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[key];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function getUnknownField(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  return (payload as Record<string, unknown>)[key];
}

function parseRepositoryPreferenceUpdates(
  payload: unknown,
): Partial<RepositoryDisplayMetadata> {
  const updates = getRecordField(payload, "updates");

  return {
    customName:
      updates && Object.hasOwn(updates, "customName")
        ? ((updates.customName as string | null | undefined) ?? null)
        : undefined,
    icon:
      updates && Object.hasOwn(updates, "icon")
        ? ((updates.icon as string | null | undefined) ?? null)
        : undefined,
    accentColor:
      updates && Object.hasOwn(updates, "accentColor")
        ? ((updates.accentColor as string | null | undefined) ?? null)
        : undefined,
  };
}

function parseAppPreferenceUpdates(payload: unknown): Partial<AppPreferences> {
  const updates = getRecordField(payload, "updates");
  const leftSidebarWidth = updates
    ? getNumberField(updates, "leftSidebarWidth")
    : undefined;
  const aiValue = updates ? getUnknownField(updates, "ai") : undefined;
  const ai =
    aiValue === null
      ? null
      : aiValue && typeof aiValue === "object"
        ? {
            ...(typeof getUnknownField(aiValue, "provider") === "string"
              ? { provider: String(getUnknownField(aiValue, "provider")) }
              : {}),
            ...(typeof getUnknownField(aiValue, "model") === "string"
              ? { model: String(getUnknownField(aiValue, "model")) }
              : {}),
          }
        : undefined;

  return {
    leftSidebarWidth,
    ai,
  };
}

function parseLegacyPreferencesImport(
  payload: unknown,
): LegacyPreferencesImport {
  const importData = getRecordField(payload, "importData");

  if (!importData) {
    return {};
  }

  const repositories = Array.isArray(importData.repositories)
    ? importData.repositories
        .filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) && typeof value === "object",
        )
        .map((repository) => ({
          repositoryId: String(repository.repositoryId ?? ""),
          customName:
            repository.customName === undefined
              ? undefined
              : repository.customName === null
                ? null
                : String(repository.customName),
          icon:
            repository.icon === undefined
              ? undefined
              : repository.icon === null
                ? null
                : String(repository.icon),
          accentColor:
            repository.accentColor === undefined
              ? undefined
              : repository.accentColor === null
                ? null
                : String(repository.accentColor),
        }))
        .filter((repository) => repository.repositoryId.length > 0)
    : undefined;

  return {
    leftSidebarWidth: getNumberField(importData, "leftSidebarWidth"),
    settings:
      importData.settings && typeof importData.settings === "object"
        ? (importData.settings as Record<string, unknown>)
        : importData.settings === null
          ? null
          : undefined,
    repositories,
  };
}

export function registerStateHandlers({
  handle,
  stateHost,
}: RegisterStateHandlersDependencies): void {
  if (!stateHost) {
    return;
  }

  handle(
    IPC_CHANNELS.state.getRepositoryPreferences,
    async (_event, payload) => {
      const repositoryId = getStringField(payload, "repositoryId");
      if (!repositoryId) {
        throw new Error(
          "State getRepositoryPreferences payload must include repositoryId",
        );
      }

      return stateHost.getRepositoryPreferences(repositoryId);
    },
  );

  handle(
    IPC_CHANNELS.state.updateRepositoryPreferences,
    async (_event, payload) => {
      const repositoryId = getStringField(payload, "repositoryId");
      if (!repositoryId) {
        throw new Error(
          "State updateRepositoryPreferences payload must include repositoryId",
        );
      }

      return stateHost.updateRepositoryPreferences(
        repositoryId,
        parseRepositoryPreferenceUpdates(payload),
      );
    },
  );

  handle(IPC_CHANNELS.state.getWorkspaceSession, async (_event, payload) => {
    const worktreeId = getStringField(payload, "worktreeId");
    if (!worktreeId) {
      throw new Error(
        "State getWorkspaceSession payload must include worktreeId",
      );
    }

    return stateHost.getWorkspaceSession(worktreeId);
  });

  handle(IPC_CHANNELS.state.saveWorkspaceSession, async (_event, payload) => {
    const session = sanitizeWorkspaceSession(
      getRecordField(payload, "session"),
    );
    if (!session?.worktreeId) {
      throw new Error(
        "State saveWorkspaceSession payload must include session",
      );
    }

    return stateHost.saveWorkspaceSession(session);
  });

  handle(IPC_CHANNELS.state.getAppPreferences, async () =>
    stateHost.getAppPreferences(),
  );

  handle(IPC_CHANNELS.state.updateAppPreferences, async (_event, payload) =>
    stateHost.updateAppPreferences(parseAppPreferenceUpdates(payload)),
  );

  handle(IPC_CHANNELS.state.importLegacyPreferences, async (_event, payload) =>
    stateHost.importLegacyPreferences(parseLegacyPreferencesImport(payload)),
  );
}

export interface StateIpcHost {
  getRepositoryPreferences(
    repositoryId: string,
  ): Promise<RepositoryPreferences | null>;
  updateRepositoryPreferences(
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ): Promise<RepositoryPreferences>;
  getWorkspaceSession(worktreeId: string): Promise<WorkspaceSession | null>;
  saveWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession>;
  getAppPreferences(): Promise<AppPreferences>;
  updateAppPreferences(
    updates: Partial<AppPreferences>,
  ): Promise<AppPreferences>;
  importLegacyPreferences(importData: LegacyPreferencesImport): Promise<{
    repositoryPreferences: RepositoryPreferences[];
    appPreferences: AppPreferences;
  }>;
}
