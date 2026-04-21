import { getActiveWorktree } from "@pi-desktop/shared";
import * as React from "react";
import { useShellModel } from "@/hooks/use-shell-model";
import { getWorkspaceSessionStore } from "@/hooks/use-window-store";
import { globalShortcutRegistry } from "@/lib/keyboard";
import type { SearchableMessage, SearchResult } from "./search-engine";
import { ThreadSearchDialog } from "./thread-search-dialog";

/**
 * The custom event consumers can listen for to focus a specific message.
 * Fired by the host when the user activates a search result.
 */
export const OPEN_MESSAGE_EVENT = "pi:open-message" as const;

export interface OpenMessageEventDetail {
  threadId: string;
  messageId: string;
}

function buildSearchableMessages(): SearchableMessage[] {
  const sessionStore = getWorkspaceSessionStore();
  const sessionState = sessionStore.getState();
  const worktreeId = sessionState.activeWorktreeId;
  if (!worktreeId) return [];

  const session = sessionState.sessionsByWorktreeId[worktreeId];
  if (!session) return [];

  const conversations = session.threadConversations;
  const result: SearchableMessage[] = [];
  for (const [threadId, conversation] of conversations.entries()) {
    for (const message of conversation.messages) {
      result.push({
        threadId,
        threadTitle: threadId,
        message,
      });
    }
  }
  return result;
}

/**
 * Mount-once host that registers the Mod+Shift+F shortcut, listens for
 * `pi:thread-search:open` / `:close` / `:toggle` custom events, and renders
 * the `ThreadSearchDialog`.
 *
 * On result activation, the host dispatches a `pi:open-message` CustomEvent
 * with `{ threadId, messageId }`. Other components (e.g. the chat thread
 * panel) can listen for it later to scroll to the message.
 */
export function ThreadSearchHost() {
  const [open, setOpen] = React.useState(false);
  const { state } = useShellModel();

  // Recompute the searchable message pool whenever the dialog opens so we
  // pick up the latest threads/messages without subscribing to the entire
  // workspace session store on every render.
  const messages = React.useMemo<SearchableMessage[]>(() => {
    if (!open) return [];

    const activeWorktree = getActiveWorktree(state.shell);
    const titleByThreadId = new Map<string, string>();
    const lastActivityByThreadId = new Map<string, number | null>();
    if (activeWorktree) {
      for (const thread of activeWorktree.threads) {
        titleByThreadId.set(thread.id, thread.title);
        lastActivityByThreadId.set(thread.id, thread.lastActivityAt);
      }
    }

    const raw = buildSearchableMessages();
    return raw.map((entry) => ({
      ...entry,
      threadTitle: titleByThreadId.get(entry.threadId) ?? entry.threadTitle,
      threadLastActivityAt: lastActivityByThreadId.get(entry.threadId) ?? null,
    }));
  }, [open, state.shell]);

  React.useEffect(() => {
    return globalShortcutRegistry.register({
      id: "thread-search.open",
      keys: "Mod+Shift+F",
      description: "Search messages across threads",
      group: "General",
      allowInInput: true,
      run: () => {
        setOpen((prev) => !prev);
      },
    });
  }, []);

  React.useEffect(() => {
    const openHandler = () => setOpen(true);
    const closeHandler = () => setOpen(false);
    const toggleHandler = () => setOpen((p) => !p);
    window.addEventListener("pi:thread-search:open", openHandler);
    window.addEventListener("pi:thread-search:close", closeHandler);
    window.addEventListener("pi:thread-search:toggle", toggleHandler);
    return () => {
      window.removeEventListener("pi:thread-search:open", openHandler);
      window.removeEventListener("pi:thread-search:close", closeHandler);
      window.removeEventListener("pi:thread-search:toggle", toggleHandler);
    };
  }, []);

  const handleSelect = React.useCallback((result: SearchResult) => {
    window.dispatchEvent(
      new CustomEvent("pi:thread-select", {
        detail: { threadId: result.threadId },
      }),
    );

    const detail: OpenMessageEventDetail = {
      threadId: result.threadId,
      messageId: result.messageId,
    };
    window.dispatchEvent(
      new CustomEvent<OpenMessageEventDetail>(OPEN_MESSAGE_EVENT, { detail }),
    );
  }, []);

  return (
    <ThreadSearchDialog
      open={open}
      onOpenChange={setOpen}
      messages={messages}
      onSelect={handleSelect}
    />
  );
}
