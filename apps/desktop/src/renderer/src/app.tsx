import { IconContext } from "@phosphor-icons/react";
import { TooltipProvider } from "@pi-desktop/ui";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { PackagesModal } from "./components/packages/packages-modal";
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
import { WorkspaceSwitchLoader } from "./components/ui/workspace-switch-loader";
import { WorkspaceShell } from "./components/workspace/workspace-shell";
import { useAppShellController } from "./hooks/use-app-shell-controller";

const WORKSPACE_SWITCH_STATE_KEY = "pi-desktop.workspace-switch-state";
const WORKSPACE_SWITCH_MIN_VISIBLE_MS = 600;

type WorkspaceSwitchState = {
  repositoryName?: string;
  startedAt?: number;
};

const APP_ROOT_STYLE = {
  "--ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
  "--duration-fast": "150ms",
  "--duration-normal": "200ms",
  "--duration-slow": "300ms",
} as React.CSSProperties;

function isWorkspaceSwitchState(value: unknown): value is WorkspaceSwitchState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (candidate.repositoryName === undefined ||
      typeof candidate.repositoryName === "string") &&
    (candidate.startedAt === undefined ||
      typeof candidate.startedAt === "number")
  );
}

function readWorkspaceSwitchState(): WorkspaceSwitchState | null {
  const serializedState = sessionStorage.getItem(WORKSPACE_SWITCH_STATE_KEY);
  if (!serializedState) {
    return null;
  }

  try {
    const parsed = JSON.parse(serializedState) as unknown;

    if (isWorkspaceSwitchState(parsed)) {
      return parsed;
    }

    sessionStorage.removeItem(WORKSPACE_SWITCH_STATE_KEY);
    return null;
  } catch {
    sessionStorage.removeItem(WORKSPACE_SWITCH_STATE_KEY);
    return null;
  }
}

export default function App() {
  const controller = useAppShellController();
  const [workspaceSwitchState, setWorkspaceSwitchState] =
    React.useState<WorkspaceSwitchState | null>(() =>
      readWorkspaceSwitchState(),
    );
  const workspaceSwitchLoaderName =
    controller.workspaceSwitchingRepositoryName ??
    workspaceSwitchState?.repositoryName ??
    null;

  React.useEffect(() => {
    if (!workspaceSwitchState) {
      return;
    }

    if (!controller.workspaceShellProps.activeRepository) {
      return;
    }

    const startedAt =
      typeof workspaceSwitchState.startedAt === "number"
        ? workspaceSwitchState.startedAt
        : Date.now();
    const remainingDuration = Math.max(
      WORKSPACE_SWITCH_MIN_VISIBLE_MS - (Date.now() - startedAt),
      0,
    );
    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(WORKSPACE_SWITCH_STATE_KEY);
      setWorkspaceSwitchState(null);
    }, remainingDuration);

    return () => window.clearTimeout(timer);
  }, [controller.workspaceShellProps.activeRepository, workspaceSwitchState]);

  return (
    <TooltipProvider>
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
            // Cursor Glass: solid near-black root, no glass effect
            "relative flex h-screen flex-col overflow-hidden",
            "rounded-[var(--window-radius)]",
            "bg-[var(--color-bg-primary)]",
            // App-level page transition animations
            "motion-safe:[&>*]:animate-in motion-safe:[&>*]:fade-in-0",
            "motion-safe:[&>*]:duration-300 motion-safe:[&>*]:fill-mode-forwards",
          )}
          style={APP_ROOT_STYLE}
        >
          <WorkspaceShell {...controller.workspaceShellProps} />
          {workspaceSwitchLoaderName ? (
            <WorkspaceSwitchLoader repositoryName={workspaceSwitchLoaderName} />
          ) : null}

          <Dialog
            open={controller.isCreateWorktreeOpen}
            onOpenChange={controller.setCreateWorktreeOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create session</DialogTitle>
                <DialogDescription>
                  Start a new session by creating a git worktree from active
                  repository branch.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 px-6 py-4">
                <input
                  data-testid="worktree-branch-input"
                  value={controller.newWorktreeBranch}
                  onChange={(e) =>
                    controller.setNewWorktreeBranch(e.target.value)
                  }
                  placeholder="feature/my-task"
                  className={cn(
                    "w-full rounded border border-white/[0.06] bg-[#141414] px-3 py-2 text-[16px] text-white/80 outline-none",
                    "transition-all duration-[var(--duration-fast)]",
                    "focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06]",
                    "placeholder:text-white/30",
                  )}
                />
                {controller.worktreeCreateError && (
                  <p className="text-[14px] text-destructive animate-pulse">
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
                  disabled={!controller.newWorktreeBranch.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <PackagesModal
            open={controller.isPackagesOpen}
            onOpenChange={controller.setPackagesOpen}
          />

          <Dialog
            open={controller.oauthDialogState.open}
            onOpenChange={controller.setOAuthDialogOpen}
          >
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader className="border-b-0 pb-2">
                <DialogTitle className="text-base font-semibold tracking-tight">
                  {controller.oauthDialogState.mode === "providers"
                    ? "Authentication"
                    : controller.oauthDialogState.mode === "logout"
                      ? "Sign out"
                      : "Sign in"}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-white/40">
                  {controller.oauthDialogState.mode === "providers"
                    ? "Choose a provider to connect your account."
                    : "Select a provider to continue this action."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col px-6 py-2">
                {controller.oauthDialogState.providers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-white/[0.02] border border-white/[0.04]">
                      <Globe className="size-6 text-white/20" />
                    </div>
                    <p className="text-[14px] text-white/40">
                      No OAuth providers available.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-white/[0.06]">
                    {controller.oauthDialogState.providers.map(
                      (provider, index) => (
                        <button
                          key={provider.id}
                          type="button"
                          disabled={controller.oauthDialogState.isBusy}
                          style={{ animationDelay: `${index * 40}ms` }}
                          onClick={() =>
                            void controller.submitOAuthDialog(provider.id)
                          }
                          className={cn(
                            "stagger-item group relative flex w-full items-center gap-4 py-4 text-left transition-all outline-none",
                            "hover:bg-white/[0.02] -mx-6 px-6",
                            "active:bg-white/[0.04] disabled:opacity-50",
                          )}
                        >
                          <Avatar className="size-9 shrink-0 rounded-sm border-white/[0.08] bg-white/[0.03]">
                            <AvatarFallback className="bg-transparent text-[14px] text-white/20">
                              {provider.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-1 flex-col min-w-0">
                            <span className="truncate text-[14px] font-medium text-white/90 group-hover:text-white">
                              {provider.name}
                            </span>
                            <span className="text-[11px] text-white/30">
                              {provider.usesCallbackServer
                                ? "Browser authentication"
                                : "Manual authentication"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {provider.isAuthenticated ? (
                              <div className="flex items-center gap-2 text-[12px] text-[var(--color-success)] font-medium">
                                <div className="size-1.5 rounded-full bg-[var(--color-success)] shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                Connected
                              </div>
                            ) : (
                              <div className="text-[12px] text-white/40 group-hover:text-white/60 transition-colors">
                                Connect
                              </div>
                            )}
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                )}

                {controller.oauthDialogState.requestedProviderId && (
                  <div className="mt-2 border-t border-white/[0.06] -mx-6 px-6 py-4 bg-white/[0.01]">
                    <div className="flex items-start gap-3 text-[12px] text-white/40">
                      <Info className="size-4 shrink-0 mt-0.5 text-white/20" />
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-white/50">
                          Provider requested
                        </span>
                        <code className="text-white/40 font-mono break-all">
                          {controller.oauthDialogState.requestedProviderId}
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
                <DialogTitle>Remove project from rail?</DialogTitle>
                <DialogDescription>
                  {controller.confirmRemoveRepositoryName
                    ? `This removes ${controller.confirmRemoveRepositoryName} from Pi only. The folder stays on disk.`
                    : "This removes the project from Pi only. The folder stays on disk."}
                </DialogDescription>
              </DialogHeader>
              {controller.removeRepositoryError ? (
                <div className="space-y-3 px-6 py-4">
                  <p className="text-[14px] text-destructive">
                    {controller.removeRepositoryError}
                  </p>
                </div>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => controller.setRemoveRepositoryOpen(false)}
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
        </div>
      </IconContext.Provider>
    </TooltipProvider>
  );
}
