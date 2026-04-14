import { describe, expect, it } from "vitest";
import {
  // RED-only pure helpers expected to be exported from the hook module
  parseModelSelectionValue,
  reduceModelSelectionState,
  resolveCurrentModelValue,
} from "../../../apps/desktop/src/renderer/src/hooks/use-shell-model";
import {
  buildFileMention,
  buildMentionSuggestions,
  buildTerminalMention,
  expandFileMentions,
  extractTerminalRoute,
  getPromptAutocompleteMatch,
  parseOAuthChatCommand,
  // RED: expected pure helpers (not implemented yet)
  planPromptDispatch,
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
      "/tmp/pi-desktop/apps/desktop/src/renderer/src/app.tsx",
    );
    expect(mention.startsWith("@file:")).toBe(true);
    expect(expandFileMentions(`Open ${mention}next`)).toContain(
      "/tmp/pi-desktop/apps/desktop/src/renderer/src/app.tsx",
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

  it("plans prompt dispatch: no-op when send is not allowed or no active thread", () => {
    expect(
      planPromptDispatch({
        draft: "hello",
        canSend: false,
        activeThreadId: "thread-1",
      }),
    ).toEqual({ action: "noop" });

    expect(
      planPromptDispatch({
        draft: "hello",
        canSend: true,
        activeThreadId: null,
      }),
    ).toEqual({ action: "noop" });
  });

  it("plans terminal routing when a terminal mention is present", () => {
    const mention = buildTerminalMention("term-123");
    const draft = `${mention} summarize the current git status`;

    const plan = planPromptDispatch({
      draft,
      canSend: true,
      activeThreadId: "thread-x",
    });

    expect(plan).toEqual({
      action: "route",
      terminalId: "term-123",
      prompt: "summarize the current git status",
      nextDraft: "",
    });
  });

  it("plans chat send and expands file mentions into the next draft", () => {
    const filePath = "/tmp/project/src/app.tsx";
    const mention = buildFileMention(filePath);
    const draft = `Please open ${mention} for review`;

    const plan = planPromptDispatch({
      draft,
      canSend: true,
      activeThreadId: "thread-xyz",
    });

    expect(plan).toEqual({
      action: "send",
      threadId: "thread-xyz",
      nextDraft: `Please open ${filePath} for review`,
    });
  });

  it("no-ops when a terminal mention exists but there is no remaining prompt text", () => {
    const mentionOnly = buildTerminalMention("term-123");
    const plan = planPromptDispatch({
      draft: mentionOnly,
      canSend: true,
      activeThreadId: "thread-1",
    });
    expect(plan).toEqual({ action: "noop" });
  });

  it("parses oauth chat commands and provider aliases", () => {
    expect(parseOAuthChatCommand("/providers")).toEqual({
      action: "providers",
    });
    expect(parseOAuthChatCommand("/login claude")).toEqual({
      action: "login",
      providerId: "anthropic",
    });
    expect(parseOAuthChatCommand("/logout openai")).toEqual({
      action: "logout",
      providerId: "openai-codex",
    });
    expect(parseOAuthChatCommand("hello /login")).toBeNull();
  });

  it("builds and dedupes mention suggestions from open windows and file search results", () => {
    const windows = [
      { kind: "terminal", terminalId: "term-1", title: "bash", cwd: "/repo" },
      { kind: "file", filePath: "/repo/src/index.ts", title: "index.ts" },
    ];

    const searchResults = [
      { type: "file", path: "/repo/src/index.ts", name: "index.ts" },
      { type: "file", path: "/repo/src/other.ts", name: "other.ts" },
    ] satisfies NonNullable<
      Parameters<typeof buildMentionSuggestions>[0]["fileSearchResults"]
    >;

    const suggestions = buildMentionSuggestions({
      windows,
      fileSearchResults: searchResults,
      query: "",
    });

    expect(Array.isArray(suggestions)).toBe(true);
    expect(
      suggestions.find((s) => s.kind === "terminal" && s.id === "term-1"),
    ).toBeTruthy();
    expect(
      suggestions.filter(
        (s) => s.kind === "file" && s.id === "/repo/src/index.ts",
      ).length,
    ).toBe(1);
    expect(
      suggestions.find(
        (s) => s.kind === "file" && s.id === "/repo/src/other.ts",
      ),
    ).toBeTruthy();
  });

  describe("model selection helpers (pure) imported from use-shell-model", () => {
    it("parses provider::model values", () => {
      expect(parseModelSelectionValue("google::gemini-1")).toEqual({
        providerId: "google",
        modelId: "gemini-1",
      });
      expect(parseModelSelectionValue("")).toBeNull();
      expect(parseModelSelectionValue("invalid-format")).toBeNull();
    });

    it("resolves the current select value from providers and settings snapshots", () => {
      const providers = [
        {
          id: "p1",
          name: "P1",
          models: [{ id: "m1", providerId: "p1", name: "M1" }],
        },
        {
          id: "p2",
          name: "P2",
          models: [{ id: "m2", providerId: "p2", name: "M2" }],
        },
      ] satisfies Parameters<typeof resolveCurrentModelValue>[0];
      const settings = {
        currentProviderId: "p2",
        currentModelId: "m2",
      } satisfies Parameters<typeof resolveCurrentModelValue>[1];

      expect(resolveCurrentModelValue(providers, settings)).toBe("p2::m2");
      expect(resolveCurrentModelValue(providers, {})).toBe("p1::m1");
    });

    it("falls back to the selected provider's first available model", () => {
      const providers = [
        {
          id: "google",
          name: "Google",
          models: [{ id: "gemini-2.5-pro", providerId: "google", name: "M1" }],
        },
        {
          id: "openai",
          name: "OpenAI",
          models: [{ id: "gpt-5", providerId: "openai", name: "GPT-5" }],
        },
      ] satisfies Parameters<typeof resolveCurrentModelValue>[0];

      expect(
        resolveCurrentModelValue(providers, {
          currentProviderId: "openai",
          defaultModel: "gemini-2.5-pro",
        }),
      ).toBe("openai::gpt-5");
    });

    it("reduces model selection UI state during switching transitions", () => {
      const initial = { isSwitchingModel: false };
      const started = reduceModelSelectionState(initial, { type: "start" });
      expect(started.isSwitchingModel).toBe(true);
      const finished = reduceModelSelectionState(started, { type: "finish" });
      expect(finished.isSwitchingModel).toBe(false);
    });
  });
});
