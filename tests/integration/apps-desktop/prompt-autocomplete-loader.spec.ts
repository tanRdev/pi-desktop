import { describe, expect, it, vi } from "vitest";
import { loadPromptAutocompleteSuggestions } from "../../../apps/desktop/src/renderer/src/lib/prompt-autocomplete-loader";

describe("prompt-autocomplete-loader", () => {
  it("loads slash suggestions from the agent host", async () => {
    const getSlashSuggestions = vi.fn(async () => ({
      suggestions: [
        {
          kind: "command" as const,
          name: "deploy",
          slash: "/deploy",
          description: "Deploy the app",
        },
      ],
      hasMore: false,
    }));

    const suggestions = await loadPromptAutocompleteSuggestions({
      draft: "/dep",
      autocompleteMatch: {
        trigger: "/",
        query: "dep",
        start: 0,
        end: 4,
      },
      activeWorktreePath: "/tmp/repo-a",
      windows: [],
      getSlashSuggestions,
      searchFiles: vi.fn(),
    });

    expect(getSlashSuggestions).toHaveBeenCalledWith({
      text: "/dep",
      cursorPosition: 4,
      trigger: "/",
      query: "dep",
    });
    expect(suggestions).toEqual([
      {
        kind: "command",
        name: "deploy",
        slash: "/deploy",
        description: "Deploy the app",
      },
    ]);
  });

  it("builds mention suggestions from workspace windows and file search", async () => {
    const searchFiles = vi.fn(async () => ({
      query: "app",
      results: [
        {
          path: "/tmp/repo-a/src/app.tsx",
          name: "app.tsx",
          score: 0.99,
          type: "file" as const,
        },
      ],
      total: 1,
      duration: 2,
    }));

    const suggestions = await loadPromptAutocompleteSuggestions({
      draft: "@app",
      autocompleteMatch: {
        trigger: "@",
        query: "app",
        start: 0,
        end: 4,
      },
      activeWorktreePath: "/tmp/repo-a",
      windows: [
        {
          kind: "terminal",
          title: "Shell",
          terminalId: "term-1",
          cwd: "/tmp/repo-a",
        },
      ],
      getSlashSuggestions: vi.fn(),
      searchFiles,
    });

    expect(searchFiles).toHaveBeenCalledWith({
      query: "app",
      rootPath: "/tmp/repo-a",
      maxResults: 8,
    });
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "file",
          id: "/tmp/repo-a/src/app.tsx",
          name: "app.tsx",
        }),
      ]),
    );
  });

  it("requests project file suggestions even for a bare @ mention", async () => {
    const searchFiles = vi.fn(async () => ({
      query: "",
      results: [
        {
          path: "/tmp/repo-a/README.md",
          name: "README.md",
          score: 0.92,
          type: "file" as const,
        },
      ],
      total: 1,
      duration: 1,
    }));

    const suggestions = await loadPromptAutocompleteSuggestions({
      draft: "@",
      autocompleteMatch: {
        trigger: "@",
        query: "",
        start: 0,
        end: 1,
      },
      activeWorktreePath: "/tmp/repo-a",
      windows: [],
      getSlashSuggestions: vi.fn(),
      searchFiles,
    });

    expect(searchFiles).toHaveBeenCalledWith({
      query: "",
      rootPath: "/tmp/repo-a",
      maxResults: 8,
    });
    expect(suggestions).toEqual([
      expect.objectContaining({
        kind: "file",
        id: "/tmp/repo-a/README.md",
        name: "README.md",
      }),
    ]);
  });
});
