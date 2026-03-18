import type { UiInteractionStore } from "./ui-interaction-store";
import type { WorkspaceSessionStore } from "./workspace-session-store";

export async function syncActiveWorktreeSession({
  nextWorktreeId,
  previousWorktreeId,
  sessionStore,
  uiStore,
}: {
  nextWorktreeId: string | null;
  previousWorktreeId: string | null;
  sessionStore: WorkspaceSessionStore;
  uiStore: UiInteractionStore;
}): Promise<void> {
  if (nextWorktreeId === previousWorktreeId) {
    return;
  }

  await sessionStore.getState().setActiveWorktree(nextWorktreeId);
  uiStore.getState().clearWorkspaceScopedState();
}
