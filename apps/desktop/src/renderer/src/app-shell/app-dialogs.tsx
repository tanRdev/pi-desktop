import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, Info } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { AppDialogsController } from "./use-app-dialogs";

export type AppDialogsProps = Pick<
  AppDialogsController,
  | "confirmRemoveRepositoryName"
  | "initGitRepoName"
  | "isCreateWorktreeOpen"
  | "isInitGitRepoOpen"
  | "isRemoveRepositoryOpen"
  | "newWorktreeBranch"
  | "oauthDialogState"
  | "removeRepositoryError"
  | "setCreateWorktreeOpen"
  | "setInitGitRepoOpen"
  | "setNewWorktreeBranch"
  | "setOAuthDialogOpen"
  | "setRemoveRepositoryOpen"
  | "skipInitGitRepo"
  | "submitCreateWorktree"
  | "submitInitGitRepo"
  | "submitOAuthDialog"
  | "submitRemoveRepository"
  | "worktreeCreateError"
>;

function getOAuthDialogTitle(
  mode: AppDialogsProps["oauthDialogState"]["mode"],
) {
  if (mode === "providers") {
    return "Authentication";
  }

  if (mode === "logout") {
    return "Sign out";
  }

  return "Sign in";
}

function getOAuthDialogDescription(
  mode: AppDialogsProps["oauthDialogState"]["mode"],
) {
  if (mode === "providers") {
    return "Choose a provider to connect your account.";
  }

  return "Select a provider to continue this action.";
}

export function AppDialogs({
  confirmRemoveRepositoryName,
  initGitRepoName,
  isCreateWorktreeOpen,
  isInitGitRepoOpen,
  isRemoveRepositoryOpen,
  newWorktreeBranch,
  oauthDialogState,
  removeRepositoryError,
  setCreateWorktreeOpen,
  setInitGitRepoOpen,
  setNewWorktreeBranch,
  setOAuthDialogOpen,
  setRemoveRepositoryOpen,
  skipInitGitRepo,
  submitCreateWorktree,
  submitInitGitRepo,
  submitOAuthDialog,
  submitRemoveRepository,
  worktreeCreateError,
}: AppDialogsProps) {
  return (
    <>
      <Dialog open={isCreateWorktreeOpen} onOpenChange={setCreateWorktreeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create session</DialogTitle>
            <DialogDescription>
              Start a new session by creating a git worktree from active
              repository branch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 bg-[var(--color-bg-secondary)] px-6 py-4">
            <input
              data-testid="worktree-branch-input"
              value={newWorktreeBranch}
              onChange={(event) => setNewWorktreeBranch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }

                event.preventDefault();

                if (
                  newWorktreeBranch.trim() ||
                  event.metaKey ||
                  event.ctrlKey
                ) {
                  void submitCreateWorktree();
                }
              }}
              placeholder="feature/my-task"
              className={cn(
                "w-full border border-white/[0.06] bg-[var(--color-bg-primary)] px-3 py-2 text-[11px] text-white/80 outline-none",
                "transition-all duration-[var(--duration-fast)]",
                "focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06]",
                "placeholder:text-white/50",
              )}
            />
            {worktreeCreateError ? (
              <p className="animate-pulse text-[11px] text-destructive">
                {worktreeCreateError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateWorktreeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCreateWorktree()}>
              {newWorktreeBranch.trim() ? (
                "Create"
              ) : (
                <span className="flex items-center gap-2">
                  Auto-name{" "}
                  <span className="font-sans text-[11px] tracking-widest text-[var(--color-bg-secondary)]/50">
                    ⌘↵
                  </span>
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={oauthDialogState.open} onOpenChange={setOAuthDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader className="border-b-0 pb-2">
            <DialogTitle className="text-base font-normal tracking-tight">
              {getOAuthDialogTitle(oauthDialogState.mode)}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-white/40">
              {getOAuthDialogDescription(oauthDialogState.mode)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col px-6 py-2">
            {oauthDialogState.providers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex size-12 items-center justify-center border border-white/[0.04] bg-white/[0.02]">
                  <Globe className="size-6 text-white/45" />
                </div>
                <p className="text-[11px] text-white/40">
                  No OAuth providers available.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-white/[0.06]">
                {oauthDialogState.providers.map((provider, index) => {
                  const isLogoutMode = oauthDialogState.mode === "logout";
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
                      disabled={oauthDialogState.isBusy || disabledForLogout}
                      style={{ animationDelay: `${index * 40}ms` }}
                      onClick={() => void submitOAuthDialog(provider.id)}
                      className={cn(
                        "stagger-item group relative -mx-6 flex w-full items-center gap-4 px-6 py-4 text-left outline-none transition-all",
                        "hover:bg-white/[0.02]",
                        "active:bg-white/[0.06] disabled:opacity-50",
                      )}
                    >
                      <Avatar className="size-9 shrink-0 border-white/[0.08] bg-white/[0.06]">
                        <AvatarFallback className="bg-transparent text-[11px] text-white/45">
                          {provider.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[11px] font-normal text-white/90 group-hover:text-white">
                          {provider.name}
                        </span>
                        <span className="text-[11px] text-white/50">
                          {provider.usesCallbackServer
                            ? "Browser authentication"
                            : "Manual authentication"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isLogoutMode ? (
                          <div
                            className={cn(
                              "text-[11px] font-normal",
                              provider.isAuthenticated
                                ? "text-white/70 group-hover:text-white"
                                : "text-white/50",
                            )}
                          >
                            {actionLabel}
                          </div>
                        ) : provider.isAuthenticated ? (
                          <div className="flex items-center gap-2 text-[11px] font-normal text-[var(--color-success)]">
                            <div className="size-1.5 bg-[var(--color-success)] shadow-[0_0_8px_rgba(95,184,122,0.3)]" />
                            {actionLabel}
                          </div>
                        ) : (
                          <div className="text-[11px] text-white/40 transition-colors group-hover:text-white/60">
                            {actionLabel}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {oauthDialogState.requestedProviderId ? (
              <div className="-mx-6 mt-2 border-t border-white/[0.06] bg-white/[0.01] px-6 py-4">
                <div className="flex items-start gap-3 text-[11px] text-white/40">
                  <Info className="mt-0.5 size-4 shrink-0 text-white/45" />
                  <div className="flex flex-col gap-1">
                    <span className="font-normal text-white/50">
                      Provider requested
                    </span>
                    <code className="break-all font-mono text-white/40">
                      {oauthDialogState.requestedProviderId}
                    </code>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t-0 bg-transparent pt-0">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => setOAuthDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRemoveRepositoryOpen}
        onOpenChange={setRemoveRepositoryOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove project from sidebar?</DialogTitle>
            <DialogDescription>
              {confirmRemoveRepositoryName
                ? `This removes ${confirmRemoveRepositoryName} from Pi only. The folder stays on disk.`
                : "This removes the project from Pi only. The folder stays on disk."}
            </DialogDescription>
          </DialogHeader>
          {removeRepositoryError ? (
            <div className="space-y-3 bg-[var(--color-bg-secondary)] px-6 py-4">
              <p className="text-[11px] text-destructive">
                {removeRepositoryError}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRemoveRepositoryOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submitRemoveRepository()}
            >
              Remove Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInitGitRepoOpen} onOpenChange={setInitGitRepoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initialize git repository?</DialogTitle>
            <DialogDescription>
              {initGitRepoName
                ? `"${initGitRepoName}" is not a git repository. Initialize one to enable version control?`
                : "This folder is not a git repository. Initialize one to enable version control?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void skipInitGitRepo()}
            >
              Not now
            </Button>
            <Button type="button" onClick={() => void submitInitGitRepo()}>
              Initialize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
