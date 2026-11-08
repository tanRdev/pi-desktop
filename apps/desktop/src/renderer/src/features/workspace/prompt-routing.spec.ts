import { describe, expect, it } from "vitest";
import {
  buildFileMention,
  expandFileMentions,
  planPromptDispatch,
} from "./prompt-routing";

describe("prompt formatting", () => {
  it("preserves code and whitespace while expanding only file mentions", () => {
    const code = "Review:\n```python\nif ready:\n    run()\n```\n\n";
    expect(expandFileMentions(code)).toBe(code);
    expect(
      expandFileMentions(`${code}${buildFileMention("/tmp/my file.py")}\nDone`),
    ).toBe(`${code}/tmp/my file.py \nDone`);
    expect(
      planPromptDispatch({ draft: code, canSend: true, activeThreadId: "a" }),
    ).toEqual({ action: "send", threadId: "a", nextDraft: code });
  });
});
