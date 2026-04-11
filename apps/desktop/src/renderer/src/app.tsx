import { IconContext } from "@phosphor-icons/react";
import { TooltipProvider } from "@pidesk/ui";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { PackagesModal } from "./components/packages/packages-modal";
import { SettingsModal, SettingsProvider } from "./components/settings";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { WorkspaceSwitchLoader } from "./components/ui/workspace-switch-loader";
import { WorkspaceShell } from "./components/workspace/workspace-shell";
import { useAppShellController } from "./hooks/use-app-shell-controller";

const WORKSPACE_SWITCH_STATE_KEY = "pidesk.workspace-switch-state";
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
    <SettingsProvider>
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
              <WorkspaceSwitchLoader
                repositoryName={workspaceSwitchLoaderName}
              />
            ) : null}

            <Dialog
              open={controller.isCreateWorktreeOpen}
              onOpenChange={controller.setCreateWorktreeOpen}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create worktree</DialogTitle>
                  <DialogDescription>
                    Start a new git worktree from the active repository branch.
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

            <SettingsModal
              open={controller.isSettingsOpen}
              onOpenChange={controller.setSettingsOpen}
            />

            <PackagesModal
              open={controller.isPackagesOpen}
              onOpenChange={controller.setPackagesOpen}
            />

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

            <Toaster />
          </div>
        </IconContext.Provider>
      </TooltipProvider>
    </SettingsProvider>
  );
}
