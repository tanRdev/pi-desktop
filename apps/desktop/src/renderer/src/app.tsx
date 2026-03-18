import { TooltipProvider } from "@pidesk/ui";
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
          className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
        >
          <WorkspaceShell {...controller.workspaceShellProps} />

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
              <div className="space-y-3 pt-4">
                <input
                  data-testid="worktree-branch-input"
                  value={controller.newWorktreeBranch}
                  onChange={(e) =>
                    controller.setNewWorktreeBranch(e.target.value)
                  }
                  placeholder="feature/my-task"
                  className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-hover"
                />
                {controller.worktreeCreateError && (
                  <p className="text-sm text-destructive">
                    {controller.worktreeCreateError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
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
