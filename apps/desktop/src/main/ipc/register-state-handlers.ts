import { registerContractHandler, stateContracts } from "@pi-desktop/contracts";
import type {
  AppPreferences,
  LegacyPreferencesImport,
  RepositoryDisplayMetadata,
  RepositoryPreferences,
  WorkspaceSession,
} from "@pi-desktop/shared";
import { sanitizeWorkspaceSession } from "../catalogs/workspace-session-catalog";
import type { RegisterIpcHandlersDependencies } from "../ipc-router";

type RegisterStateHandlersDependencies = Pick<
  RegisterIpcHandlersDependencies,
  "handle" | "stateHost"
>;

export function registerStateHandlers({
  handle,
  stateHost,
}: RegisterStateHandlersDependencies): void {
  if (!stateHost) {
    return;
  }

  registerContractHandler({
    handle,
    contract: stateContracts.getRepositoryPreferences,
    handler: async ({ repositoryId }) =>
      stateHost.getRepositoryPreferences(repositoryId),
  });

  registerContractHandler({
    handle,
    contract: stateContracts.updateRepositoryPreferences,
    handler: async ({ repositoryId, updates }) =>
      stateHost.updateRepositoryPreferences(repositoryId, updates),
  });

  registerContractHandler({
    handle,
    contract: stateContracts.getWorkspaceSession,
    handler: async ({ worktreeId }) =>
      stateHost.getWorkspaceSession(worktreeId),
  });

  registerContractHandler({
    handle,
    contract: stateContracts.saveWorkspaceSession,
    handler: async ({ session }) => {
      const sanitized = sanitizeWorkspaceSession(session);
      if (!sanitized?.worktreeId) {
        throw new Error(
          "State saveWorkspaceSession payload must include session",
        );
      }

      return stateHost.saveWorkspaceSession(sanitized);
    },
  });

  registerContractHandler({
    handle,
    contract: stateContracts.getAppPreferences,
    handler: async () => stateHost.getAppPreferences(),
  });

  registerContractHandler({
    handle,
    contract: stateContracts.updateAppPreferences,
    handler: async ({ updates }) => stateHost.updateAppPreferences(updates),
  });

  registerContractHandler({
    handle,
    contract: stateContracts.importLegacyPreferences,
    handler: async ({ importData }) =>
      stateHost.importLegacyPreferences(importData),
  });

  registerContractHandler({
    handle,
    contract: stateContracts.getCatalogQuarantineNotices,
    handler: async () => stateHost.getCatalogQuarantineNotices(),
  });
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
  getCatalogQuarantineNotices(): Promise<Array<{ catalogLabel: string }>>;
}
