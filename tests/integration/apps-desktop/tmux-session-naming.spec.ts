import { describe, expect, it } from "vitest";
import {
  createTmuxThreadSessionName,
  isManagedTmuxThreadSession,
} from "../../../apps/desktop/src/main/tmux-session-naming";

describe("tmux thread session naming", () => {
  it("derives stable managed session names from durable thread ids", () => {
    const first = createTmuxThreadSessionName("thread-123");
    const second = createTmuxThreadSessionName("thread-123");
    const different = createTmuxThreadSessionName("thread-456");

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toMatch(/^pidesk-thread-/);
    expect(first.length).toBeLessThanOrEqual(48);
  });

  it("sanitizes arbitrary thread ids and detects managed tmux sessions", () => {
    const sessionName = createTmuxThreadSessionName(
      "Repo Thread: Feature/Settings #1",
    );

    expect(sessionName).toMatch(/^pidesk-thread-[a-z0-9-]+$/);
    expect(isManagedTmuxThreadSession(sessionName)).toBe(true);
    expect(isManagedTmuxThreadSession("user-manual-session")).toBe(false);
  });
});
