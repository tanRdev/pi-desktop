import { TooltipProvider } from "@pidesk/ui";
import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "@/lib/toast";
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

const WORKSPACE_SWITCH_NOTICE_KEY = "pidesk.workspace-switch-notice";
const WORKSPACE_SWITCH_STATE_KEY = "pidesk.workspace-switch-state";
const WORKSPACE_SWITCH_MIN_VISIBLE_MS = 600;

type WorkspaceSwitchState = {
  repositoryName?: string;
  startedAt?: number;
};

function readWorkspaceSwitchState(): WorkspaceSwitchState | null {
  const serializedState = sessionStorage.getItem(WORKSPACE_SWITCH_STATE_KEY);
  if (!serializedState) {
    return null;
  }

  try {
    return JSON.parse(serializedState) as WorkspaceSwitchState;
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

  React.useEffect(() => {
    const serializedNotice = sessionStorage.getItem(
      WORKSPACE_SWITCH_NOTICE_KEY,
    );
    if (!serializedNotice) {
      return;
    }

    sessionStorage.removeItem(WORKSPACE_SWITCH_NOTICE_KEY);

    try {
      const notice = JSON.parse(serializedNotice) as {
        repositoryName?: string;
      };
      toast.success("Project switched", {
        description:
          notice.repositoryName && notice.repositoryName.trim().length > 0
            ? `Opened ${notice.repositoryName}`
            : "Opened the selected workspace",
      });
    } catch {
      toast.success("Project switched");
    }
  }, []);

  return (
    <SettingsProvider>
      <TooltipProvider>
        <div
          data-testid="app-ready"
          className={cn(
            // Cursor Glass: solid near-black root, no glass effect
            "relative flex h-screen flex-col overflow-hidden",
            "rounded-[var(--window-radius)]",
            "bg-[#0a0a0a]",
            // App-level page transition animations
            "motion-safe:[&>*]:animate-in motion-safe:[&>*]:fade-in-0",
            "motion-safe:[&>*]:duration-300 motion-safe:[&>*]:fill-mode-forwards",
          )}
          style={{
            // Emil Design: Custom easing via CSS variable
            ["--ease-out" as string]: "cubic-bezier(0.23, 1, 0.32, 1)",
            // Reduced motion: respect user preferences at app level
            ["--duration-fast" as string]: "150ms",
            ["--duration-normal" as string]: "200ms",
            ["--duration-slow" as string]: "300ms",
          }}
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
                    "w-full rounded border border-white/[0.06] bg-[#141414] px-3 py-2 text-[13px] text-white/80 outline-none",
                    "transition-all duration-[var(--duration-fast)]",
                    "focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06]",
                    "placeholder:text-white/30",
                  )}
                />
                {controller.worktreeCreateError && (
                  <p className="text-[12px] text-destructive animate-pulse">
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
                  <p className="text-[12px] text-destructive">
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
      </TooltipProvider>
    </SettingsProvider>
  );
}
