// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkspaceShellTargetMessage } from "./workspace-shell-target-message";

describe("useWorkspaceShellTargetMessage", () => {
  it("keeps the active target until the same message reports navigation", () => {
    const { result } = renderHook(() => useWorkspaceShellTargetMessage());

    act(() => {
      result.current.setTargetMessageId("message-9");
    });

    expect(result.current.targetMessageId).toBe("message-9");

    act(() => {
      result.current.handleTargetMessageNavigated("message-2");
    });

    expect(result.current.targetMessageId).toBe("message-9");

    act(() => {
      result.current.handleTargetMessageNavigated("message-9");
    });

    expect(result.current.targetMessageId).toBeNull();
  });
});
