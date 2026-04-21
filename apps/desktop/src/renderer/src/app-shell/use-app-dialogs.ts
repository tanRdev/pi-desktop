import type { OAuthProviderSnapshot } from "@pi-desktop/shared";
import { getActiveRepository } from "@pi-desktop/shared";
import * as React from "react";
import { useStore } from "zustand";
import { toast } from "@/lib/toast";
import type { UiInteractionStore } from "@/stores/ui-interaction-store";
import { createThreadTitle as createDefaultThreadTitle } from "../../../thread-title-defaults";

function getErrorDescription(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export interface OAuthDialogState {
  open: boolean;
  mode: "providers" | "login" | "logout";
  providers: OAuthProviderSnapshot[];
  requestedProviderId: string | null;
  isBusy: boolean;
}

export interface ConfirmRemoveRepositoryInput {
  repositoryId: string;
  repositoryName: string;
}

export interface AppDialogsController {
  oauthDialogState: OAuthDialogState;
  setOAuthDialogOpen: (open: boolean) => void;
  submitOAuthDialog: (providerId: string) => Promise<void>;
  openOAuthDialog: (
    mode: OAuthDialogState["mode"],
    providerId: string | null,
  ) => Promise<void>;
  isCreateWorktreeOpen: boolean;
  setCreateWorktreeOpen: (isOpen: boolean) => void;
  newWorktreeBranch: string;
  setNewWorktreeBranch: (value: string) => void;
  worktreeCreateError: string | null;
  submitCreateWorktree: () => Promise<void>;
  confirmRemoveRepository: (input: ConfirmRemoveRepositoryInput) => void;
  confirmRemoveRepositoryName: string | null;
  isRemoveRepositoryOpen: boolean;
  setRemoveRepositoryOpen: (isOpen: boolean) => void;
  removeRepositoryError: string | null;
  submitRemoveRepository: () => Promise<void>;
  isInitGitRepoOpen: boolean;
  setInitGitRepoOpen: (isOpen: boolean) => void;
  requestInitGitRepo: (
    path: string,
    name: string,
    options?: { continueToCreateWorktree?: boolean },
  ) => void;
  initGitRepoPath: string | null;
  initGitRepoName: string | null;
  submitInitGitRepo: () => Promise<void>;
  skipInitGitRepo: () => Promise<void>;
}

export interface UseAppDialogsOptions {
  activeRepositoryId: string | null;
  reload: () => Promise<void>;
  uiStore: UiInteractionStore;
  createThreadTitle?: () => string;
}

export function useAppDialogs({
  activeRepositoryId,
  reload,
  uiStore,
  createThreadTitle = createDefaultThreadTitle,
}: UseAppDialogsOptions): AppDialogsController {
  const isCreateWorktreeOpen = useStore(
    uiStore,
    (storeState) => storeState.dialogs.createWorktree,
  );
  const isRemoveRepositoryOpen = useStore(
    uiStore,
    (storeState) => storeState.dialogs.confirmRemoveRepository,
  );
  const isInitGitRepoOpen = useStore(
    uiStore,
    (storeState) => storeState.dialogs.initGitRepo,
  );

  const [newWorktreeBranch, setNewWorktreeBranch] = React.useState("");
  const [worktreeCreateError, setWorktreeCreateError] = React.useState<
    string | null
  >(null);
  const [confirmRemoveRepositoryId, setConfirmRemoveRepositoryId] =
    React.useState<string | null>(null);
  const [confirmRemoveRepositoryName, setConfirmRemoveRepositoryName] =
    React.useState<string | null>(null);
  const [removeRepositoryError, setRemoveRepositoryError] = React.useState<
    string | null
  >(null);
  const [initGitRepoPath, setInitGitRepoPath] = React.useState<string | null>(
    null,
  );
  const [initGitRepoName, setInitGitRepoName] = React.useState<string | null>(
    null,
  );
  const [
    continueToCreateWorktreeAfterInit,
    setContinueToCreateWorktreeAfterInit,
  ] = React.useState(false);
  const [oauthProviders, setOAuthProviders] = React.useState<
    OAuthProviderSnapshot[]
  >([]);
  const [oauthDialogOpen, setOAuthDialogOpenState] = React.useState(false);
  const [oauthDialogMode, setOAuthDialogMode] =
    React.useState<OAuthDialogState["mode"]>("providers");
  const [oauthRequestedProviderId, setOAuthRequestedProviderId] =
    React.useState<string | null>(null);
  const [isOAuthBusy, setIsOAuthBusy] = React.useState(false);

  const loadOAuthProviders = React.useCallback(async () => {
    const providers = await window.piDesktop.agent.getOAuthProviders();
    setOAuthProviders(providers);
    return providers;
  }, []);

  const setOAuthDialogOpen = React.useCallback((open: boolean) => {
    setOAuthDialogOpenState(open);
    if (!open) {
      setOAuthRequestedProviderId(null);
      setOAuthDialogMode("providers");
    }
  }, []);

  const performOAuthAction = React.useCallback(
    async (mode: OAuthDialogState["mode"], providerId: string) => {
      setIsOAuthBusy(true);
      try {
        if (mode === "logout") {
          await window.piDesktop.agent.logoutOAuth(providerId);
          toast.success("Logged out", { description: providerId });
        } else {
          await window.piDesktop.agent.loginWithOAuth(providerId);
          toast.success("Login complete", { description: providerId });
        }

        await reload();
        setOAuthDialogOpen(false);
      } catch (error) {
        toast.error(mode === "logout" ? "Logout failed" : "Login failed", {
          description: getErrorDescription(
            error,
            mode === "logout"
              ? "Could not clear provider credentials"
              : "Could not complete provider authentication",
          ),
        });
      } finally {
        setIsOAuthBusy(false);
      }
    },
    [reload, setOAuthDialogOpen],
  );

  const submitOAuthDialog = React.useCallback(
    async (providerId: string) => {
      await performOAuthAction(oauthDialogMode, providerId);
    },
    [oauthDialogMode, performOAuthAction],
  );

  const openOAuthDialog = React.useCallback(
    async (mode: OAuthDialogState["mode"], providerId: string | null) => {
      try {
        const providers = await loadOAuthProviders();
        setOAuthDialogMode(mode);
        setOAuthRequestedProviderId(providerId);

        if (
          providerId &&
          mode !== "providers" &&
          providers.some((provider) => provider.id === providerId)
        ) {
          await performOAuthAction(mode, providerId);
          return;
        }

        setOAuthDialogOpenState(true);
      } catch (error) {
        toast.error("Failed to load providers", {
          description: getErrorDescription(
            error,
            "Could not load OAuth providers",
          ),
        });
      }
    },
    [loadOAuthProviders, performOAuthAction],
  );

  const setCreateWorktreeOpen = React.useCallback(
    (isOpen: boolean) => {
      uiStore.getState().setDialogOpen("createWorktree", isOpen);
    },
    [uiStore],
  );

  const setRemoveRepositoryOpen = React.useCallback(
    (isOpen: boolean) => {
      uiStore.getState().setDialogOpen("confirmRemoveRepository", isOpen);
    },
    [uiStore],
  );

  const setInitGitRepoOpen = React.useCallback(
    (isOpen: boolean) => {
      uiStore.getState().setDialogOpen("initGitRepo", isOpen);
      if (!isOpen) {
        setInitGitRepoPath(null);
        setInitGitRepoName(null);
        setContinueToCreateWorktreeAfterInit(false);
      }
    },
    [uiStore],
  );

  const submitCreateWorktree = React.useCallback(async () => {
    let branchName = newWorktreeBranch.trim();
    if (!branchName) {
      branchName = `session/${createThreadTitle().toLowerCase()}`;
    }

    let repositoryId = activeRepositoryId;
    if (!repositoryId) {
      const freshShell = await window.piDesktop.shell.getSnapshot();
      repositoryId = getActiveRepository(freshShell)?.id ?? null;
    }

    if (!repositoryId) {
      return;
    }

    try {
      await window.piDesktop.worktrees.create(repositoryId, branchName);
      setCreateWorktreeOpen(false);
      setNewWorktreeBranch("");
      setWorktreeCreateError(null);
      await reload();
      toast.success("Session created");
    } catch (error) {
      setWorktreeCreateError(
        error instanceof Error ? error.message : "Failed to create worktree",
      );
    }
  }, [
    activeRepositoryId,
    createThreadTitle,
    newWorktreeBranch,
    reload,
    setCreateWorktreeOpen,
  ]);

  const confirmRemoveRepository = React.useCallback(
    ({ repositoryId, repositoryName }: ConfirmRemoveRepositoryInput) => {
      setConfirmRemoveRepositoryId(repositoryId);
      setConfirmRemoveRepositoryName(repositoryName);
      setRemoveRepositoryError(null);
      setRemoveRepositoryOpen(true);
    },
    [setRemoveRepositoryOpen],
  );

  const submitRemoveRepository = React.useCallback(async () => {
    if (!confirmRemoveRepositoryId) {
      return;
    }

    try {
      await window.piDesktop.repositories.remove(confirmRemoveRepositoryId);
      setRemoveRepositoryOpen(false);
      setConfirmRemoveRepositoryId(null);
      setConfirmRemoveRepositoryName(null);
      setRemoveRepositoryError(null);
      toast.success("Project removed");
      await reload();
    } catch (error) {
      setRemoveRepositoryError(
        error instanceof Error ? error.message : "Failed to remove repository",
      );
    }
  }, [confirmRemoveRepositoryId, reload, setRemoveRepositoryOpen]);

  const requestInitGitRepo = React.useCallback(
    (
      path: string,
      name: string,
      options?: { continueToCreateWorktree?: boolean },
    ) => {
      setInitGitRepoPath(path);
      setInitGitRepoName(name);
      setContinueToCreateWorktreeAfterInit(
        options?.continueToCreateWorktree ?? false,
      );
      setInitGitRepoOpen(true);
    },
    [setInitGitRepoOpen],
  );

  const submitInitGitRepo = React.useCallback(async () => {
    if (!initGitRepoPath || !initGitRepoName) {
      return;
    }

    try {
      await window.piDesktop.git.init(initGitRepoPath);
      await window.piDesktop.repositories.add(initGitRepoPath);
      setInitGitRepoOpen(false);
      if (continueToCreateWorktreeAfterInit) {
        setCreateWorktreeOpen(true);
      }
      await reload();
      toast.success("Git repository initialized");
    } catch (error) {
      toast.error("Failed to initialize git repository", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [
    continueToCreateWorktreeAfterInit,
    initGitRepoName,
    initGitRepoPath,
    reload,
    setCreateWorktreeOpen,
    setInitGitRepoOpen,
  ]);

  const skipInitGitRepo = React.useCallback(async () => {
    if (!initGitRepoPath) {
      setInitGitRepoOpen(false);
      return;
    }

    try {
      await window.piDesktop.repositories.add(initGitRepoPath);
      await reload();
    } catch {
      // Non-repo folders are handled by the main process.
    }
    setInitGitRepoOpen(false);
  }, [initGitRepoPath, reload, setInitGitRepoOpen]);

  return {
    oauthDialogState: {
      open: oauthDialogOpen,
      mode: oauthDialogMode,
      providers: oauthProviders,
      requestedProviderId: oauthRequestedProviderId,
      isBusy: isOAuthBusy,
    },
    setOAuthDialogOpen,
    submitOAuthDialog,
    openOAuthDialog,
    isCreateWorktreeOpen,
    setCreateWorktreeOpen,
    newWorktreeBranch,
    setNewWorktreeBranch,
    worktreeCreateError,
    submitCreateWorktree,
    confirmRemoveRepository,
    confirmRemoveRepositoryName,
    isRemoveRepositoryOpen,
    setRemoveRepositoryOpen,
    removeRepositoryError,
    submitRemoveRepository,
    isInitGitRepoOpen,
    setInitGitRepoOpen,
    requestInitGitRepo,
    initGitRepoPath,
    initGitRepoName,
    submitInitGitRepo,
    skipInitGitRepo,
  };
}
