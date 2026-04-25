import {
  type AppPreferences,
  IPC_CHANNELS,
  type LegacyPreferencesImport,
  type RepositoryDisplayMetadata,
  type RepositoryPreferences,
  type WorkspaceSession,
} from "@pi-desktop/shared";

import type { PreloadInvoke } from "./updates-api";

export type { PreloadInvoke } from "./updates-api";

export interface StateApi {
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

export function createStateApi({
  invoke,
}: {
  invoke: PreloadInvoke;
}): StateApi {
  return {
    getRepositoryPreferences(repositoryId: string) {
      return invoke<RepositoryPreferences | null>(
        IPC_CHANNELS.state.getRepositoryPreferences,
        { repositoryId },
      );
    },
    updateRepositoryPreferences(
      repositoryId: string,
      updates: Partial<RepositoryDisplayMetadata>,
    ) {
      return invoke<RepositoryPreferences>(
        IPC_CHANNELS.state.updateRepositoryPreferences,
        { repositoryId, updates },
      );
    },
    getWorkspaceSession(worktreeId: string) {
      return invoke<WorkspaceSession | null>(
        IPC_CHANNELS.state.getWorkspaceSession,
        { worktreeId },
      );
    },
    saveWorkspaceSession(session: WorkspaceSession) {
      return invoke<WorkspaceSession>(IPC_CHANNELS.state.saveWorkspaceSession, {
        session,
      });
    },
    getAppPreferences() {
      return invoke<AppPreferences>(
        IPC_CHANNELS.state.getAppPreferences,
        undefined,
      );
    },
    updateAppPreferences(updates: Partial<AppPreferences>) {
      return invoke<AppPreferences>(IPC_CHANNELS.state.updateAppPreferences, {
        updates,
      });
    },
    importLegacyPreferences(importData: LegacyPreferencesImport) {
      return invoke<{
        repositoryPreferences: RepositoryPreferences[];
        appPreferences: AppPreferences;
      }>(IPC_CHANNELS.state.importLegacyPreferences, {
        importData,
      });
    },
  };
}
