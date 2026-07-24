import { createContractInvoker, stateContracts } from "@pi-desktop/contracts";
import type {
  AppPreferences,
  LegacyPreferencesImport,
  RepositoryDisplayMetadata,
  RepositoryPreferences,
  WorkspaceSession,
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
  getCatalogQuarantineNotices(): Promise<Array<{ catalogLabel: string }>>;
}

export function createStateApi({
  invoke,
}: {
  invoke: PreloadInvoke;
}): StateApi {
  const invokeContract = createContractInvoker(invoke);

  return {
    getRepositoryPreferences(repositoryId: string) {
      return invokeContract(stateContracts.getRepositoryPreferences, {
        repositoryId,
      });
    },
    updateRepositoryPreferences(
      repositoryId: string,
      updates: Partial<RepositoryDisplayMetadata>,
    ) {
      return invokeContract(stateContracts.updateRepositoryPreferences, {
        repositoryId,
        updates,
      });
    },
    getWorkspaceSession(worktreeId: string) {
      return invokeContract(stateContracts.getWorkspaceSession, {
        worktreeId,
      });
    },
    saveWorkspaceSession(session: WorkspaceSession) {
      return invokeContract(stateContracts.saveWorkspaceSession, { session });
    },
    getAppPreferences() {
      return invokeContract(stateContracts.getAppPreferences);
    },
    updateAppPreferences(updates: Partial<AppPreferences>) {
      return invokeContract(stateContracts.updateAppPreferences, { updates });
    },
    importLegacyPreferences(importData: LegacyPreferencesImport) {
      return invokeContract(stateContracts.importLegacyPreferences, {
        importData,
      });
    },
    getCatalogQuarantineNotices() {
      return invokeContract(stateContracts.getCatalogQuarantineNotices);
    },
  };
}
