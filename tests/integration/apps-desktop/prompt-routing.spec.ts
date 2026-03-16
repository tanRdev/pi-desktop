import { describe, expect, it } from "vitest";
import {
  buildFileMention,
  buildTerminalMention,
  expandFileMentions,
  extractTerminalRoute,
  getPromptAutocompleteMatch,
  replacePromptToken,
} from "../../../apps/desktop/src/renderer/src/lib/prompt-routing";

describe("prompt-routing helpers", () => {
  it("detects slash and mention autocomplete tokens at the end of the draft", () => {
    expect(getPromptAutocompleteMatch("Use /dep")).toEqual({
      trigger: "/",
      query: "dep",
      start: 4,
      end: 8,
    });

    expect(getPromptAutocompleteMatch("Investigate @app")).toEqual({
      trigger: "@",
      query: "app",
      start: 12,
      end: 16,
    });

    expect(getPromptAutocompleteMatch("No token here")).toBeNull();
  });

  it("replaces the active autocomplete token with a chosen suggestion", () => {
    const match = getPromptAutocompleteMatch("Use /dep");
    expect(match).not.toBeNull();
    if (!match) {
      throw new Error("autocomplete match missing");
    }

    expect(replacePromptToken("Use /dep", match, "/deploy ")).toBe(
      "Use /deploy ",
    );
  });

  it("builds and expands file mentions safely", () => {
    const mention = buildFileMention(
      "/tmp/pidesk/apps/desktop/src/renderer/src/app.tsx",
    );
    expect(mention.startsWith("@file:")).toBe(true);
    expect(expandFileMentions(`Open ${mention}next`)).toContain(
      "/tmp/pidesk/apps/desktop/src/renderer/src/app.tsx",
    );
  });

  it("extracts terminal routing targets and strips mentions from the prompt", () => {
    const terminalMention = buildTerminalMention("term-123").trim();
    const parsed = extractTerminalRoute(
      `${terminalMention} summarize the current git status`,
    );

    expect(parsed.terminalIds).toEqual(["term-123"]);
    expect(parsed.prompt).toBe("summarize the current git status");
  });
});
