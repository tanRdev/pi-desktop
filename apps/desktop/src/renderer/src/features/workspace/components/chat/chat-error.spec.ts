import { describe, expect, it } from "vitest";

import { describeChatError } from "./chat-error";

describe("describeChatError", () => {
  it("classifies auth failures without using the raw string as the title", () => {
    const result = describeChatError(
      "OAuth login failed: Unauthorized 401 for anthropic",
    );
    expect(result.kind).toBe("auth");
    expect(result.title).toBe("Sign-in required");
    expect(result.title.toLowerCase()).not.toContain("unauthorized");
    expect(result.guidance.toLowerCase()).toMatch(/connect|authenticat|retry/);
  });

  it("classifies token and model failures with next steps", () => {
    expect(describeChatError("token limit exceeded").kind).toBe("token");
    expect(describeChatError("model foo is unavailable").kind).toBe("model");
    expect(describeChatError("boom").kind).toBe("generic");
  });
});
