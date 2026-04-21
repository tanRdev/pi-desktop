import { IconContext } from "@phosphor-icons/react";
import { TooltipProvider } from "@pi-desktop/ui";
import * as React from "react";
import { useSessionRecovery } from "@/features/session-recovery";
import { createSnapshotApi, createSnapshotStore } from "@/features/snapshots";
import { OnboardingGuard } from "@/features/workspace/components/onboarding";
import { WorkspaceShell } from "@/features/workspace/components/workspace-shell";
import { useAppShellController } from "@/features/workspace/use-app-shell-controller";
import { ThemeProvider } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { AppDialogs } from "./app-shell/app-dialogs";
import { AppHosts } from "./app-shell/app-hosts";
import { RootErrorBoundary } from "./components/error-boundary";
import { UpdateBanner } from "./components/ui/update-banner";
import { getWorkspaceSessionStore } from "./hooks/use-window-store";

const EMPTY_FILES: readonly { filePath: string; content: string }[] = [];

function useSearchReplaceFiles() {
  const sessionStore = getWorkspaceSessionStore();
  const sessionState = sessionStore.getState();
  const activeWorktreeId = sessionState.activeWorktreeId;
  const session = activeWorktreeId
    ? sessionState.sessionsByWorktreeId[activeWorktreeId]
    : undefined;

  return React.useMemo(() => {
    if (!session) return EMPTY_FILES;
    const files: { filePath: string; content: string }[] = [];
    for (const win of session.layout.windows) {
      if (win.kind !== "file") continue;
      const fileState = session.fileContents.get(win.id);
      if (!fileState) continue;
      const fileContent = fileState.content;
      if (fileContent && !fileState.isLoading) {
        files.push({ filePath: win.filePath, content: fileContent.content });
      }
    }
    return files.length > 0 ? files : EMPTY_FILES;
  }, [session]);
}

function useSnapshotApi() {
  return React.useMemo(() => {
    const store = createSnapshotStore({
      storage: globalThis.localStorage,
      getActiveSession: () => {
        const sessionStore = getWorkspaceSessionStore();
        const { activeWorktreeId, sessionsByWorktreeId } =
          sessionStore.getState();
        if (!activeWorktreeId) return null;
        const session = sessionsByWorktreeId[activeWorktreeId];
        return session ?? null;
      },
    });
    return createSnapshotApi({
      store,
      applyRestoredSession: (restored) => {
        const sessionStore = getWorkspaceSessionStore();
        const { activeWorktreeId } = sessionStore.getState();
        if (!activeWorktreeId) return;
        void window.piDesktop.state.saveWorkspaceSession(restored);
        sessionStore.getState().setActiveWorktree(activeWorktreeId);
      },
    });
  }, []);
}

const APP_ROOT_STYLE = {
  "--ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
  "--duration-fast": "150ms",
  "--duration-normal": "200ms",
  "--duration-slow": "300ms",
} as React.CSSProperties;

export default function App() {
  const controller = useAppShellController();
  const snapshotApi = useSnapshotApi();
  const searchReplaceFiles = useSearchReplaceFiles();
  useSessionRecovery({
    getSessionSnapshot: () => {
      const sessionStore = getWorkspaceSessionStore();
      const { activeWorktreeId, sessionsByWorktreeId } =
        sessionStore.getState();
      if (!activeWorktreeId) return null;
      const session = sessionsByWorktreeId[activeWorktreeId];
      return session ?? null;
    },
  });

  return (
    <RootErrorBoundary>
      <TooltipProvider>
        <ThemeProvider>
          <OnboardingGuard>
            <IconContext.Provider
              value={{
                color: "currentColor",
                size: "1.25rem", // 20px
                weight: "light", // ~1.5px
                mirrored: false,
              }}
            >
              <div
                data-testid="app-ready"
                className={cn(
                  // Solid near-black root, no glass effect
                  "relative flex h-screen flex-col overflow-hidden",

                  "bg-[var(--color-bg-primary)]",
                  // App-level page transition animations
                  "motion-safe:[&>*]:animate-in motion-safe:[&>*]:fade-in-0",
                  "motion-safe:[&>*]:duration-300 motion-safe:[&>*]:fill-mode-forwards",
                )}
                style={APP_ROOT_STYLE}
              >
                <UpdateBanner />
                {/* TODO: wrap <ChatThreadPanel /> (rendered inside WorkspaceShell)
              with a granular <ErrorBoundary name="Chat thread"> once the
              panel can be imported here without restructuring WorkspaceShell. */}
                <WorkspaceShell {...controller.workspaceShellProps} />
                <AppDialogs
                  confirmRemoveRepositoryName={
                    controller.confirmRemoveRepositoryName
                  }
                  initGitRepoName={controller.initGitRepoName}
                  isCreateWorktreeOpen={controller.isCreateWorktreeOpen}
                  isInitGitRepoOpen={controller.isInitGitRepoOpen}
                  isRemoveRepositoryOpen={controller.isRemoveRepositoryOpen}
                  newWorktreeBranch={controller.newWorktreeBranch}
                  oauthDialogState={controller.oauthDialogState}
                  removeRepositoryError={controller.removeRepositoryError}
                  setCreateWorktreeOpen={controller.setCreateWorktreeOpen}
                  setInitGitRepoOpen={controller.setInitGitRepoOpen}
                  setNewWorktreeBranch={controller.setNewWorktreeBranch}
                  setOAuthDialogOpen={controller.setOAuthDialogOpen}
                  setRemoveRepositoryOpen={controller.setRemoveRepositoryOpen}
                  skipInitGitRepo={controller.skipInitGitRepo}
                  submitCreateWorktree={controller.submitCreateWorktree}
                  submitInitGitRepo={controller.submitInitGitRepo}
                  submitOAuthDialog={controller.submitOAuthDialog}
                  submitRemoveRepository={controller.submitRemoveRepository}
                  worktreeCreateError={controller.worktreeCreateError}
                />
                <AppHosts
                  snapshotApi={snapshotApi}
                  searchReplaceFiles={searchReplaceFiles}
                />
              </div>
            </IconContext.Provider>
          </OnboardingGuard>
        </ThemeProvider>
      </TooltipProvider>
    </RootErrorBoundary>
  );
}
