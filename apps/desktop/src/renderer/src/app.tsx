import { TooltipProvider } from "@pidesk/ui";
import { cn } from "@/lib/utils";
import { SettingsModal, SettingsProvider } from "./components/settings";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { WorkspaceShell } from "./components/workspace/workspace-shell";
import { useAppShellController } from "./hooks/use-app-shell-controller";

export default function App() {
  const controller = useAppShellController();

  return (
    <SettingsProvider>
      <TooltipProvider>
        <div
          data-testid="app-ready"
          className={cn(
            "relative flex h-screen flex-col overflow-hidden bg-background text-foreground",
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

          <Dialog
            open={controller.isCreateWorktreeOpen}
            onOpenChange={controller.setCreateWorktreeOpen}
          >
            <DialogContent
              className={cn(
                "sm:max-w-md",
                // Dialog open/close transitions with Emil Design easing
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
                "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
                "motion-reduce:transition-none motion-reduce:animate-none",
              )}
              style={{
                transitionDuration: "var(--duration-normal)",
                transitionTimingFunction: "var(--ease-out)",
              }}
            >
              <DialogHeader>
                <DialogTitle>Create worktree</DialogTitle>
                <DialogDescription>
                  Start a new git worktree from the active repository branch.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-4">
                <input
                  data-testid="worktree-branch-input"
                  value={controller.newWorktreeBranch}
                  onChange={(e) =>
                    controller.setNewWorktreeBranch(e.target.value)
                  }
                  placeholder="feature/my-task"
                  className={cn(
                    "w-full rounded border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none",
                    "motion-safe:transition-all",
                    "focus:border-border-hover focus:ring-1 focus:ring-ring/30",
                    "placeholder:text-muted-foreground",
                  )}
                  style={{
                    transitionDuration: "var(--duration-fast)",
                    transitionTimingFunction: "var(--ease-out)",
                  }}
                />
                {controller.worktreeCreateError && (
                  <p
                    className={cn(
                      "text-sm text-destructive",
                      // Error pulse with reduced motion support
                      "motion-safe:animate-pulse motion-reduce:animate-none",
                    )}
                  >
                    {controller.worktreeCreateError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => controller.setCreateWorktreeOpen(false)}
                    className={cn(
                      // Ghost button with Emil Design interactions
                      "motion-safe:transition-all motion-safe:hover:translate-x-0.5",
                      "motion-reduce:transition-none",
                    )}
                    style={{
                      transitionDuration: "var(--duration-fast)",
                      transitionTimingFunction: "var(--ease-out)",
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void controller.submitCreateWorktree()}
                    disabled={!controller.newWorktreeBranch.trim()}
                    className={cn(
                      // Primary button with Emil Design scale interactions
                      "motion-safe:transition-transform",
                      "motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]",
                      "motion-reduce:transition-none motion-reduce:transform-none",
                    )}
                    style={{
                      transitionDuration: "var(--duration-fast)",
                      transitionTimingFunction: "var(--ease-out)",
                    }}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <SettingsModal
            open={controller.isSettingsOpen}
            onOpenChange={controller.setSettingsOpen}
          />
        </div>
      </TooltipProvider>
    </SettingsProvider>
  );
}
