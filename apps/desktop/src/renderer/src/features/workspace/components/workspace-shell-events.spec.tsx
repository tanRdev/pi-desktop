// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_MESSAGE_EVENT } from "./thread-search/thread-search-host";
import { useWorkspaceShellEvents } from "./workspace-shell-events";

describe("useWorkspaceShellEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers workspace shell event listeners and routes parsed details", () => {
    const onCreateThread = vi.fn();
    const onToggleSidebar = vi.fn();
    const onSelectThread = vi.fn();
    const onTargetMessage = vi.fn();
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() =>
      useWorkspaceShellEvents({
        activeWorktreeId: "worktree-1",
        onCreateThread,
        onToggleSidebar,
        onSelectThread,
        onTargetMessage,
      }),
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "pi:command",
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "pi:command:new-thread",
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "pi:command:toggle-sidebar",
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "pi:thread-select",
      expect.any(Function),
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      OPEN_MESSAGE_EVENT,
      expect.any(Function),
    );

    window.dispatchEvent(
      new CustomEvent("pi:command", {
        detail: { commandId: "new-thread" },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("pi:command", {
        detail: { commandId: "new" },
      }),
    );
    window.dispatchEvent(new Event("pi:command:new-thread"));
    window.dispatchEvent(
      new CustomEvent("pi:command", {
        detail: { commandId: "toggle-sidebar" },
      }),
    );
    window.dispatchEvent(new Event("pi:command:toggle-sidebar"));
    window.dispatchEvent(
      new CustomEvent("pi:thread-select", {
        detail: { threadId: "thread-2" },
      }),
    );
    window.dispatchEvent(
      new CustomEvent(OPEN_MESSAGE_EVENT, {
        detail: { threadId: "thread-3", messageId: "message-9" },
      }),
    );

    expect(onCreateThread).toHaveBeenNthCalledWith(1, "worktree-1");
    expect(onCreateThread).toHaveBeenNthCalledWith(2, "worktree-1");
    expect(onCreateThread).toHaveBeenNthCalledWith(3, "worktree-1");
    expect(onToggleSidebar).toHaveBeenCalledTimes(2);
    expect(onSelectThread).toHaveBeenNthCalledWith(1, "thread-2");
    expect(onSelectThread).toHaveBeenNthCalledWith(2, "thread-3");
    expect(onTargetMessage).toHaveBeenCalledWith("message-9");

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pi:command",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pi:command:new-thread",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pi:command:toggle-sidebar",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pi:thread-select",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      OPEN_MESSAGE_EVENT,
      expect.any(Function),
    );
  });

  it("ignores invalid custom-event payloads and missing worktrees", () => {
    const onCreateThread = vi.fn();
    const onToggleSidebar = vi.fn();
    const onSelectThread = vi.fn();
    const onTargetMessage = vi.fn();

    renderHook(() =>
      useWorkspaceShellEvents({
        activeWorktreeId: null,
        onCreateThread,
        onToggleSidebar,
        onSelectThread,
        onTargetMessage,
      }),
    );

    window.dispatchEvent(new Event("pi:command"));
    window.dispatchEvent(
      new CustomEvent("pi:command", {
        detail: { commandId: "new-thread" },
      }),
    );
    window.dispatchEvent(new Event("pi:command:new-thread"));
    window.dispatchEvent(
      new CustomEvent("pi:thread-select", {
        detail: { threadId: 42 },
      }),
    );
    window.dispatchEvent(
      new CustomEvent(OPEN_MESSAGE_EVENT, {
        detail: { threadId: 99, messageId: null },
      }),
    );

    expect(onCreateThread).not.toHaveBeenCalled();
    expect(onToggleSidebar).not.toHaveBeenCalled();
    expect(onSelectThread).not.toHaveBeenCalled();
    expect(onTargetMessage).not.toHaveBeenCalled();
  });
});
