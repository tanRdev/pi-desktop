import type {
  AppPreferences,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import * as React from "react";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
} from "@/hooks/use-shell-model";
import { toast } from "@/lib/toast";

function getErrorDescription(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export interface UseWorkspaceShellControlsOptions {
  agentStatus: string;
  runtimeMode: string;
  providerSnapshots: ProviderSnapshot[];
  settingsSnapshot: SettingsSnapshot;
  appPreferences: AppPreferences;
  reload: () => Promise<void>;
  switchModel: (selection: {
    providerId: string;
    modelId: string;
  }) => Promise<void>;
  updateAppPreferences: (updates: Partial<AppPreferences>) => Promise<void>;
  openOAuthDialog: (
    mode: "providers" | "login" | "logout",
    providerId: string | null,
  ) => Promise<void>;
}

export interface WorkspaceShellControlsController {
  displayAgentStatus: string;
  runtimeModeLabel: string;
  currentModelValue: string;
  favoriteModels: string[];
  leftSidebarWidth: number;
  handleModelSelection: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => Promise<void>;
  handleToggleFavorite: (modelValue: string) => void;
  handleModelMenuOpenChange: (open: boolean) => void;
  handleLeftSidebarResize: (width: number) => void;
  handleConnectProvider: () => void;
}

export function useWorkspaceShellControls({
  agentStatus,
  runtimeMode,
  providerSnapshots,
  settingsSnapshot,
  appPreferences,
  reload,
  switchModel,
  updateAppPreferences,
  openOAuthDialog,
}: UseWorkspaceShellControlsOptions): WorkspaceShellControlsController {
  const favoriteModels = React.useMemo(
    () => appPreferences.favoriteModels ?? [],
    [appPreferences.favoriteModels],
  );
  const leftSidebarWidth = appPreferences.leftSidebarWidth ?? 260;
  const runtimeModeLabel = `${runtimeMode} mode`;
  const displayAgentStatus = agentStatus;
  const currentModelValue = React.useMemo(
    () => resolveCurrentModelValue(providerSnapshots, settingsSnapshot),
    [providerSnapshots, settingsSnapshot],
  );

  const handleModelSelection = React.useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selection = parseModelSelectionValue(event.target.value);
      if (!selection) {
        return;
      }

      await switchModel(selection).then(undefined, (error) => {
        toast.error("Failed to switch model", {
          description: getErrorDescription(
            error,
            "The selected model could not be activated",
          ),
        });
      });
    },
    [switchModel],
  );

  const handleToggleFavorite = React.useCallback(
    (modelValue: string) => {
      const current = appPreferences.favoriteModels ?? [];
      const next = current.includes(modelValue)
        ? current.filter((value) => value !== modelValue)
        : [...current, modelValue];
      void updateAppPreferences({ favoriteModels: next });
    },
    [appPreferences.favoriteModels, updateAppPreferences],
  );

  const handleModelMenuOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        return;
      }

      void reload();
    },
    [reload],
  );

  const handleLeftSidebarResize = React.useCallback(
    (width: number) => {
      void updateAppPreferences({ leftSidebarWidth: width });
    },
    [updateAppPreferences],
  );

  const handleConnectProvider = React.useCallback(() => {
    void openOAuthDialog("providers", null);
  }, [openOAuthDialog]);

  return {
    displayAgentStatus,
    runtimeModeLabel,
    currentModelValue,
    favoriteModels,
    leftSidebarWidth,
    handleModelSelection,
    handleToggleFavorite,
    handleModelMenuOpenChange,
    handleLeftSidebarResize,
    handleConnectProvider,
  };
}
