import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverPiResources,
  getPiSlashSuggestions,
} from "../../../apps/desktop/src/main/pi-resource-discovery";
import { loadPromptAutocompleteSuggestions } from "../../../apps/desktop/src/renderer/src/lib/prompt-autocomplete-loader";
import {
  getPromptAutocompleteMatch,
  replacePromptToken,
} from "../../../apps/desktop/src/renderer/src/lib/prompt-routing";
import { createUiInteractionStore } from "../../../apps/desktop/src/renderer/src/stores/ui-interaction-store";
import type { SlashSuggestion } from "../../../packages/shared/src";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "pi-desktop-slash-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("slash menu trigger detection", () => {
  it("detects a bare slash at the start of the draft as a slash trigger", () => {
    const match = getPromptAutocompleteMatch("/");
    expect(match).not.toBeNull();
    expect(match?.trigger).toBe("/");
    expect(match?.query).toBe("");
    expect(match?.start).toBe(0);
    expect(match?.end).toBe(1);
  });

  it("detects a slash after a space as a slash trigger", () => {
    const match = getPromptAutocompleteMatch("hello /bra");
    expect(match).not.toBeNull();
    expect(match?.trigger).toBe("/");
    expect(match?.query).toBe("bra");
    expect(match?.start).toBe(6);
    expect(match?.end).toBe(10);
  });

  it("detects a slash at the start with a query string", () => {
    const match = getPromptAutocompleteMatch("/deploy");
    expect(match).not.toBeNull();
    expect(match?.trigger).toBe("/");
    expect(match?.query).toBe("deploy");
    expect(match?.start).toBe(0);
    expect(match?.end).toBe(7);
  });

  it("does not detect a slash in the middle of a word", () => {
    expect(getPromptAutocompleteMatch("path/to/file")).toBeNull();
  });

  it("does not detect a slash when followed by a space", () => {
    expect(getPromptAutocompleteMatch("/ ")).toBeNull();
  });

  it("detects an at-sign mention after a space", () => {
    const match = getPromptAutocompleteMatch("look at @ter");
    expect(match).not.toBeNull();
    expect(match?.trigger).toBe("@");
    expect(match?.query).toBe("ter");
  });

  it("returns null for text without trigger characters", () => {
    expect(getPromptAutocompleteMatch("hello world")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(getPromptAutocompleteMatch("")).toBeNull();
  });
});

describe("slash menu token replacement", () => {
  it("replaces a slash token with a skill suggestion", () => {
    const draft = "Use /bra";
    const match = getPromptAutocompleteMatch(draft);
    expect(match).not.toBeNull();
    if (match === null) {
      throw new Error("Expected slash autocomplete match");
    }

    const result = replacePromptToken(draft, match, "/skill:brainstorming ");
    expect(result).toBe("Use /skill:brainstorming ");
  });

  it("replaces a slash token at the start of the draft", () => {
    const draft = "/dep";
    const match = getPromptAutocompleteMatch(draft);
    expect(match).not.toBeNull();
    if (match === null) {
      throw new Error("Expected slash autocomplete match");
    }

    const result = replacePromptToken(draft, match, "/deploy ");
    expect(result).toBe("/deploy ");
  });

  it("replaces a bare slash with a skill suggestion", () => {
    const draft = "/";
    const match = getPromptAutocompleteMatch(draft);
    expect(match).not.toBeNull();
    if (match === null) {
      throw new Error("Expected slash autocomplete match");
    }

    const result = replacePromptToken(draft, match, "/skill:build ");
    expect(result).toBe("/skill:build ");
  });
});

describe("slash menu end-to-end: trigger → discovery → suggestion", () => {
  it("produces slash suggestions when a user types / in the prompt", async () => {
    const slashSuggestions: SlashSuggestion[] = [
      {
        kind: "skill",
        name: "brainstorm",
        slash: "/skill:brainstorm",
        description: "Brainstorm ideas",
      },
      {
        kind: "skill",
        name: "deploy",
        slash: "/skill:deploy",
        description: "Deploy the app",
      },
      { kind: "command", name: "fix", slash: "/fix", description: "Fix bugs" },
      { kind: "command", name: "ship", slash: "/ship", description: "Ship it" },
    ];

    const getSlashSuggestions = async () => ({
      suggestions: slashSuggestions,
      hasMore: false,
    });

    const match = getPromptAutocompleteMatch("/");
    expect(match).not.toBeNull();
    if (match === null) {
      throw new Error("Expected slash autocomplete match");
    }

    const suggestions = await loadPromptAutocompleteSuggestions({
      draft: "/",
      autocompleteMatch: match,
      activeWorktreePath: "/tmp/repo",
      windows: [],
      getSlashSuggestions,
      searchFiles: async () => ({ results: [] }),
    });

    expect(suggestions).toEqual(slashSuggestions);
  });

  it("filters slash suggestions when the user types / followed by a query", async () => {
    const filteredSuggestions: SlashSuggestion[] = [
      {
        kind: "command",
        name: "deploy",
        slash: "/deploy",
        description: "Deploy the app",
      },
    ];

    const getSlashSuggestions = async () => ({
      suggestions: filteredSuggestions,
      hasMore: false,
    });

    const match = getPromptAutocompleteMatch("/dep");
    expect(match).not.toBeNull();
    if (match === null) {
      throw new Error("Expected slash autocomplete match");
    }

    const suggestions = await loadPromptAutocompleteSuggestions({
      draft: "/dep",
      autocompleteMatch: match,
      activeWorktreePath: "/tmp/repo",
      windows: [],
      getSlashSuggestions,
      searchFiles: async () => ({ results: [] }),
    });

    expect(suggestions).toEqual(filteredSuggestions);
  });

  it("does not call getSlashSuggestions when the trigger is @ (mention) instead of /", async () => {
    const match = getPromptAutocompleteMatch("@file");
    expect(match).not.toBeNull();
    if (match === null) {
      throw new Error("Expected mention autocomplete match");
    }

    const getSlashSuggestions = async () => ({
      suggestions: [
        { kind: "command" as const, name: "deploy", slash: "/deploy" },
      ],
      hasMore: false,
    });

    const suggestions = await loadPromptAutocompleteSuggestions({
      draft: "@file",
      autocompleteMatch: match,
      activeWorktreePath: "/tmp/repo",
      windows: [],
      getSlashSuggestions,
      searchFiles: async () => ({ results: [] }),
    });

    expect(suggestions.every((s) => s.kind !== "command")).toBe(true);
  });
});

describe("slash menu discovery: skills and commands from filesystem", () => {
  it("discovers skills from SKILL.md files", () => {
    const agentDir = createTempDir();
    const skillDir = path.join(agentDir, "skills", "brainstorming");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "# Brainstorming\nGenerate ideas.",
      "utf8",
    );

    const discovery = discoverPiResources(agentDir, agentDir);
    expect(discovery.skills).toHaveLength(1);
    expect(discovery.skills[0].name).toBe("brainstorming");
    expect(discovery.skills[0].description).toBeTruthy();
  });

  it("discovers commands from markdown files in commands directory", () => {
    const agentDir = createTempDir();
    const commandDir = path.join(agentDir, "commands");
    mkdirSync(commandDir, { recursive: true });
    writeFileSync(
      path.join(commandDir, "deploy.md"),
      "# Deploy\nShip the app.",
      "utf8",
    );

    const discovery = discoverPiResources(agentDir, agentDir);
    expect(discovery.commands).toHaveLength(1);
    expect(discovery.commands[0].name).toBe("deploy");
  });

  it("returns slash suggestions including both skills and commands", () => {
    const agentDir = createTempDir();
    const skillDir = path.join(agentDir, "skills", "review");
    const commandDir = path.join(agentDir, "commands");
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(commandDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "# Review\nReview code changes.",
      "utf8",
    );
    writeFileSync(
      path.join(commandDir, "deploy.md"),
      "# Deploy\nDeploy the app.",
      "utf8",
    );

    const suggestions = getPiSlashSuggestions({
      agentDir,
      cwd: agentDir,
      discoveryOptions: {
        homeDir: agentDir,
        includeMachineAgentRoots: false,
      },
      context: {
        text: "/",
        cursorPosition: 1,
        trigger: "/" as const,
        query: "",
      },
    });

    expect(suggestions.kind).toBe("slash");
    expect(suggestions.suggestions.length).toBeGreaterThanOrEqual(2);

    const skillSuggestion = suggestions.suggestions.find(
      (s) => s.kind === "skill",
    );
    const commandSuggestion = suggestions.suggestions.find(
      (s) => s.kind === "command",
    );
    expect(skillSuggestion).toBeTruthy();
    expect((skillSuggestion as SlashSuggestion).slash).toBe("/skill:review");
    expect(commandSuggestion).toBeTruthy();
    expect((commandSuggestion as SlashSuggestion).slash).toBe("/deploy");
  });

  it("filters suggestions by query string", () => {
    const agentDir = createTempDir();
    const skillDir = path.join(agentDir, "skills", "brainstorming");
    const commandDir = path.join(agentDir, "commands");
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(commandDir, { recursive: true });
    writeFileSync(path.join(skillDir, "SKILL.md"), "# Brainstorming", "utf8");
    writeFileSync(path.join(commandDir, "deploy.md"), "# Deploy", "utf8");
    writeFileSync(path.join(commandDir, "debug.md"), "# Debug", "utf8");

    const suggestions = getPiSlashSuggestions({
      agentDir,
      cwd: agentDir,
      discoveryOptions: {
        homeDir: agentDir,
        includeMachineAgentRoots: false,
      },
      context: {
        text: "/de",
        cursorPosition: 3,
        trigger: "/" as const,
        query: "de",
      },
    });

    for (const s of suggestions.suggestions) {
      expect(s.name.toLowerCase()).toContain("de");
    }
  });
});

describe("slash menu autocomplete state management", () => {
  it("sets and retrieves autocomplete suggestions", () => {
    const store = createUiInteractionStore();

    const suggestions = [
      {
        kind: "skill" as const,
        name: "brainstorming",
        slash: "/skill:brainstorming",
        description: "Generate ideas",
      },
      {
        kind: "command" as const,
        name: "deploy",
        slash: "/deploy",
        description: "Deploy the app",
      },
    ];

    store.getState().setPromptAutocomplete(suggestions);
    expect(store.getState().promptAutocompleteSuggestions).toEqual(suggestions);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(0);

    store.getState().setPromptAutocompleteSelectedIndex(1);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(1);

    store.getState().clearPromptAutocomplete();
    expect(store.getState().promptAutocompleteSuggestions).toEqual([]);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(-1);
  });

  it("resets selectedIndex to 0 when new suggestions are set", () => {
    const store = createUiInteractionStore();
    const suggestions = [
      {
        kind: "skill" as const,
        name: "brainstorming",
        slash: "/skill:brainstorming",
      },
    ];

    store.getState().setPromptAutocompleteSelectedIndex(5);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(5);

    store.getState().setPromptAutocomplete(suggestions);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(0);
  });

  it("sets selectedIndex to -1 when empty suggestions are provided", () => {
    const store = createUiInteractionStore();
    const suggestions = [
      {
        kind: "skill" as const,
        name: "brainstorming",
        slash: "/skill:brainstorming",
      },
    ];

    store.getState().setPromptAutocomplete(suggestions);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(0);

    store.getState().setPromptAutocomplete([]);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(-1);
  });
});
