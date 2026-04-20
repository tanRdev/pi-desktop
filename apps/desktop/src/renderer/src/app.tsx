import { IconContext } from "@phosphor-icons/react";
import { TooltipProvider } from "@pi-desktop/ui";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardHost } from "@/lib/keyboard";
import { NotificationHost } from "@/lib/notifications";
import {
  createSnapshotApi,
  createSnapshotStore,
  SnapshotHost,
} from "@/lib/snapshots";
import { ThemeProvider } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { AppShortcuts } from "./app-shortcuts";
import { CommandPaletteHost } from "./components/command-palette";
import { RootErrorBoundary } from "./components/error-boundary";
import { SettingsHost } from "./components/settings";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Globe, Info } from "./components/ui/icons";
import { UpdateBanner } from "./components/ui/update-banner";
import { ActivityPanelHost } from "./components/workspace/activity-panel";
import { OnboardingGuard } from "./components/workspace/onboarding";
import { SearchReplaceHost } from "./components/workspace/search-replace";
import { ThreadSearchHost } from "./components/workspace/thread-search";
import { WorkspaceShell } from "./components/workspace/workspace-shell";
import { useAppShellController } from "./hooks/use-app-shell-controller";
import { getWorkspaceSessionStore } from "./hooks/use-window-store";
import { PerfHost } from "./lib/perf";
import { useSessionRecovery } from "./lib/session-recovery";

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

                <Dialog
                  open={controller.isCreateWorktreeOpen}
                  onOpenChange={controller.setCreateWorktreeOpen}
                >
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create session</DialogTitle>
                      <DialogDescription>
                        Start a new session by creating a git worktree from
                        active repository branch.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 px-6 py-4 bg-[var(--color-bg-secondary)]">
                      <input
                        data-testid="worktree-branch-input"
                        value={controller.newWorktreeBranch}
                        onChange={(e) =>
                          controller.setNewWorktreeBranch(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (
                              controller.newWorktreeBranch.trim() ||
                              e.metaKey ||
                              e.ctrlKey
                            ) {
                              void controller.submitCreateWorktree();
                            }
                          }
                        }}
                        placeholder="feature/my-task"
                        className={cn(
                          "w-full border border-white/[0.06] bg-[var(--color-bg-primary)] px-3 py-2 text-[10.5px] text-white/80 outline-none",
                          "transition-all duration-[var(--duration-fast)]",
                          "focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06]",
                          "placeholder:text-white/30",
                        )}
                      />
                      {controller.worktreeCreateError && (
                        <p className="text-[10.5px] text-destructive animate-pulse">
                          {controller.worktreeCreateError}
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => controller.setCreateWorktreeOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void controller.submitCreateWorktree()}
                      >
                        {controller.newWorktreeBranch.trim() ? (
                          "Create"
                        ) : (
                          <span className="flex items-center gap-2">
                            Auto-name{" "}
                            <span className="font-sans text-[11px] text-[var(--color-bg-secondary)]/50 tracking-widest">
                              ⌘↵
                            </span>
                          </span>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={controller.oauthDialogState.open}
                  onOpenChange={controller.setOAuthDialogOpen}
                >
                  <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader className="border-b-0 pb-2">
                      <DialogTitle className="text-base font-normal tracking-tight">
                        {controller.oauthDialogState.mode === "providers"
                          ? "Authentication"
                          : controller.oauthDialogState.mode === "logout"
                            ? "Sign out"
                            : "Sign in"}
                      </DialogTitle>
                      <DialogDescription className="text-[10.5px] text-white/40">
                        {controller.oauthDialogState.mode === "providers"
                          ? "Choose a provider to connect your account."
                          : "Select a provider to continue this action."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col px-6 py-2">
                      {controller.oauthDialogState.providers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="mb-4 flex size-12 items-center justify-center bg-white/[0.02] border border-white/[0.04]">
                            <Globe className="size-6 text-white/20" />
                          </div>
                          <p className="text-[10.5px] text-white/40">
                            No OAuth providers available.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col divide-y divide-white/[0.06]">
                          {controller.oauthDialogState.providers.map(
                            (provider, index) => {
                              const isLogoutMode =
                                controller.oauthDialogState.mode === "logout";
                              const disabledForLogout =
                                isLogoutMode && !provider.isAuthenticated;
                              const actionLabel = isLogoutMode
                                ? provider.isAuthenticated
                                  ? "Sign out"
                                  : "Not connected"
                                : provider.isAuthenticated
                                  ? "Connected"
                                  : "Connect";
                              return (
                                <button
                                  key={provider.id}
                                  type="button"
                                  disabled={
                                    controller.oauthDialogState.isBusy ||
                                    disabledForLogout
                                  }
                                  style={{ animationDelay: `${index * 40}ms` }}
                                  onClick={() =>
                                    void controller.submitOAuthDialog(
                                      provider.id,
                                    )
                                  }
                                  className={cn(
                                    "stagger-item group relative flex w-full items-center gap-4 py-4 text-left transition-all outline-none",
                                    "hover:bg-white/[0.02] -mx-6 px-6",
                                    "active:bg-white/[0.04] disabled:opacity-50",
                                  )}
                                >
                                  <Avatar className="size-9 shrink-0 border-white/[0.08] bg-white/[0.03]">
                                    <AvatarFallback className="bg-transparent text-[10.5px] text-white/20">
                                      {provider.name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-1 flex-col min-w-0">
                                    <span className="truncate text-[10.5px] font-normal text-white/90 group-hover:text-white">
                                      {provider.name}
                                    </span>
                                    <span className="text-[11px] text-white/30">
                                      {provider.usesCallbackServer
                                        ? "Browser authentication"
                                        : "Manual authentication"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isLogoutMode ? (
                                      <div
                                        className={cn(
                                          "text-[10.5px] font-normal",
                                          provider.isAuthenticated
                                            ? "text-white/70 group-hover:text-white"
                                            : "text-white/30",
                                        )}
                                      >
                                        {actionLabel}
                                      </div>
                                    ) : provider.isAuthenticated ? (
                                      <div className="flex items-center gap-2 text-[10.5px] text-[var(--color-success)] font-normal">
                                        <div className="size-1.5 bg-[var(--color-success)] shadow-[0_0_8px_rgba(95,184,122,0.3)]" />
                                        {actionLabel}
                                      </div>
                                    ) : (
                                      <div className="text-[10.5px] text-white/40 group-hover:text-white/60 transition-colors">
                                        {actionLabel}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            },
                          )}
                        </div>
                      )}

                      {controller.oauthDialogState.requestedProviderId && (
                        <div className="mt-2 border-t border-white/[0.06] -mx-6 px-6 py-4 bg-white/[0.01]">
                          <div className="flex items-start gap-3 text-[10.5px] text-white/40">
                            <Info className="size-4 shrink-0 mt-0.5 text-white/20" />
                            <div className="flex flex-col gap-1">
                              <span className="font-normal text-white/50">
                                Provider requested
                              </span>
                              <code className="text-white/40 font-mono break-all">
                                {
                                  controller.oauthDialogState
                                    .requestedProviderId
                                }
                              </code>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <DialogFooter className="border-t-0 bg-transparent pt-0">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full sm:w-auto"
                        onClick={() => controller.setOAuthDialogOpen(false)}
                      >
                        Close
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={controller.isRemoveRepositoryOpen}
                  onOpenChange={controller.setRemoveRepositoryOpen}
                >
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Remove project from sidebar?</DialogTitle>
                      <DialogDescription>
                        {controller.confirmRemoveRepositoryName
                          ? `This removes ${controller.confirmRemoveRepositoryName} from Pi only. The folder stays on disk.`
                          : "This removes the project from Pi only. The folder stays on disk."}
                      </DialogDescription>
                    </DialogHeader>
                    {controller.removeRepositoryError ? (
                      <div className="space-y-3 px-6 py-4 bg-[var(--color-bg-secondary)]">
                        <p className="text-[10.5px] text-destructive">
                          {controller.removeRepositoryError}
                        </p>
                      </div>
                    ) : null}
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          controller.setRemoveRepositoryOpen(false)
                        }
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void controller.submitRemoveRepository()}
                      >
                        Remove Project
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={controller.isInitGitRepoOpen}
                  onOpenChange={controller.setInitGitRepoOpen}
                >
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Initialize git repository?</DialogTitle>
                      <DialogDescription>
                        {controller.initGitRepoName
                          ? `"${controller.initGitRepoName}" is not a git repository. Initialize one to enable version control?`
                          : "This folder is not a git repository. Initialize one to enable version control?"}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void controller.skipInitGitRepo()}
                      >
                        Not now
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void controller.submitInitGitRepo()}
                      >
                        Initialize
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Toaster />
                <CommandPaletteHost />
                <ThreadSearchHost />
                <SettingsHost />
                <KeyboardHost />
                <NotificationHost />
                <PerfHost />
                <AppShortcuts />
                <SnapshotHost api={snapshotApi} />
                <ActivityPanelHost />
                <SearchReplaceHost files={searchReplaceFiles} />
              </div>
            </IconContext.Provider>
          </OnboardingGuard>
        </ThemeProvider>
      </TooltipProvider>
    </RootErrorBoundary>
  );
}
