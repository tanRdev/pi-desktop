import { TooltipProvider } from "@pidesk/ui";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { SettingsModal, SettingsProvider } from "./components/settings";
import { Button } from "./components/ui/button";
import { PackagesModal } from "./components/packages/packages-modal";
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

          {controller.toastMessage ? (
            <div className="pointer-events-none fixed bottom-5 right-5 z-[120] rounded-md border border-white/[0.08] bg-[#111111] px-3 py-2 text-[12px] text-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
              {controller.toastMessage}
            </div>
          ) : null}

          <Dialog
            open={controller.isCreateWorktreeOpen}
            onOpenChange={controller.setCreateWorktreeOpen}
          >
            <DialogContent
              className={cn(
                "sm:max-w-md",
                // Cursor Glass: solid dark dialog
                "bg-[#0e0e0e] border border-white/[0.06]",
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
                    "w-full rounded border border-white/[0.06] bg-[#141414] px-3 py-2 text-sm text-white/80 outline-none",
                    "motion-safe:transition-all",
                    "focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06]",
                    "placeholder:text-white/30",
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

          <PackagesModal
            open={controller.isPackagesOpen}
            onOpenChange={controller.setPackagesOpen}
          />

          <Dialog
            open={controller.isCreateThreadOpen}
            onOpenChange={controller.setCreateThreadOpen}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Name your new thread</DialogTitle>
                <DialogDescription>
                  {controller.pendingThreadRepositoryName
                    ? `Start a conversation in ${controller.pendingThreadRepositoryName}. Leave empty for a random name.`
                    : "Leave empty for a random name."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-4 px-6">
                <input
                  data-testid="thread-name-input"
                  value={controller.newThreadName}
                  onChange={(e) => controller.setNewThreadName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void controller.submitCreateThread();
                    }
                  }}
                  placeholder="Leave empty for a random name"
                  className="w-full rounded border border-white/[0.06] bg-[#141414] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/30"
                />
                {controller.threadCreateError ? (
                  <p className="text-sm text-destructive">
                    {controller.threadCreateError}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 px-6 py-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => controller.setCreateThreadOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => controller.setNewThreadName("")}
                >
                  Random Name
                </Button>
                <Button
                  type="button"
                  onClick={() => void controller.submitCreateThread()}
                >
                  Create Thread
                </Button>
              </div>
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
                    ? `This removes ${controller.confirmRemoveRepositoryName} from PiDesk only. The folder stays on disk.`
                    : "This removes the project from PiDesk only. The folder stays on disk."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-4 px-6">
                {controller.removeRepositoryError ? (
                  <p className="text-sm text-destructive">
                    {controller.removeRepositoryError}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 px-6 py-4">
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
              </div>
            </DialogContent>
          </Dialog>

          <Toaster />
        </div>
      </TooltipProvider>
    </SettingsProvider>
  );
}
