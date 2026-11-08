import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDraft, usePersistDraft, writeDraft } from "./prompt-draft";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("thread draft persistence", () => {
  it("restores before writing and keeps drafts separate across switches and remounts", () => {
    writeDraft("a", "saved A");
    writeDraft("b", "saved B");
    function useDraft({ threadId }: { threadId: string }) {
      const [draft, setDraft] = useState("");
      usePersistDraft(threadId, draft, setDraft);
      return { draft, setDraft };
    }
    const { result, rerender, unmount } = renderHook(useDraft, {
      initialProps: { threadId: "a" },
    });
    expect(result.current.draft).toBe("saved A");
    act(() => result.current.setDraft("new A"));
    rerender({ threadId: "b" });
    expect(result.current.draft).toBe("saved B");
    expect(readDraft("a")).toBe("new A");
    act(() => result.current.setDraft("new B"));
    rerender({ threadId: "a" });
    expect(result.current.draft).toBe("new A");
    unmount();
    const remounted = renderHook(useDraft, { initialProps: { threadId: "b" } });
    expect(remounted.result.current.draft).toBe("new B");
  });
});
