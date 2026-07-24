import * as React from "react";
import { toast } from "@/lib/toast";
import { OPEN_MESSAGE_EVENT } from "./thread-search/thread-search-host";

interface WorkspaceShellEventsOptions {
  activeWorktreeId: string | null;
  onCreateThread: (worktreeId: string) => string | Promise<string>;
  onToggleSidebar: () => void;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onTargetMessage: (messageId: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getEventDetail(event: Event) {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  return isRecord(event.detail) ? event.detail : null;
}

function getStringDetail(
  detail: Record<string, unknown>,
  key: string,
): string | null {
  const value = Reflect.get(detail, key);
  return typeof value === "string" ? value : null;
}

function createThread(
  activeWorktreeId: string | null,
  onCreateThread: (worktreeId: string) => string | Promise<string>,
) {
  if (!activeWorktreeId) {
    return;
  }

  void onCreateThread(activeWorktreeId);
}

async function clearThread(): Promise<void> {
  try {
    await window.piDesktop.agent.reset();
    toast.success("Thread cleared");
    window.dispatchEvent(new CustomEvent("pi:command:clear-thread"));
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Could not clear thread",
    );
  }
}

function openShortcutHelp(): void {
  window.dispatchEvent(new CustomEvent("pi:shortcut-help:open"));
}

function openModelPicker(): void {
  window.dispatchEvent(
    new CustomEvent("pi:command", {
      detail: { commandId: "open-model-picker" },
    }),
  );
}

export function useWorkspaceShellEvents({
  activeWorktreeId,
  onCreateThread,
  onToggleSidebar,
  onSelectThread,
  onTargetMessage,
}: WorkspaceShellEventsOptions) {
  React.useEffect(() => {
    const handleCommand = (event: Event) => {
      const detail = getEventDetail(event);
      if (!detail) {
        return;
      }

      const commandId = getStringDetail(detail, "commandId");
      if (commandId === "new-thread" || commandId === "new") {
        createThread(activeWorktreeId, onCreateThread);
        return;
      }

      if (commandId === "toggle-sidebar") {
        onToggleSidebar();
        return;
      }

      if (commandId === "help") {
        openShortcutHelp();
        return;
      }

      if (commandId === "clear") {
        void clearThread();
        return;
      }

      if (commandId === "model") {
        openModelPicker();
      }
    };

    const handleNewThreadCommand = () => {
      createThread(activeWorktreeId, onCreateThread);
    };

    const handleToggleSidebarCommand = () => {
      onToggleSidebar();
    };

    const handleThreadSelect = (event: Event) => {
      const detail = getEventDetail(event);
      if (!detail) {
        return;
      }

      const threadId = getStringDetail(detail, "threadId");
      if (threadId) {
        void onSelectThread(threadId);
      }
    };

    const handleOpenMessage = (event: Event) => {
      const detail = getEventDetail(event);
      if (!detail) {
        return;
      }

      const threadId = getStringDetail(detail, "threadId");
      if (threadId) {
        void onSelectThread(threadId);
      }

      const messageId = getStringDetail(detail, "messageId");
      if (messageId) {
        onTargetMessage(messageId);
      }
    };

    window.addEventListener("pi:command", handleCommand);
    window.addEventListener("pi:command:new-thread", handleNewThreadCommand);
    window.addEventListener(
      "pi:command:toggle-sidebar",
      handleToggleSidebarCommand,
    );
    window.addEventListener("pi:thread-select", handleThreadSelect);
    window.addEventListener(OPEN_MESSAGE_EVENT, handleOpenMessage);

    return () => {
      window.removeEventListener("pi:command", handleCommand);
      window.removeEventListener(
        "pi:command:new-thread",
        handleNewThreadCommand,
      );
      window.removeEventListener(
        "pi:command:toggle-sidebar",
        handleToggleSidebarCommand,
      );
      window.removeEventListener("pi:thread-select", handleThreadSelect);
      window.removeEventListener(OPEN_MESSAGE_EVENT, handleOpenMessage);
    };
  }, [
    activeWorktreeId,
    onCreateThread,
    onSelectThread,
    onTargetMessage,
    onToggleSidebar,
  ]);
}
