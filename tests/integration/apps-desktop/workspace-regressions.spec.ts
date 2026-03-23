import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("workspace regressions", () => {
  it("removes the old empty canvas copy from the live workspace shell", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(shellSource).not.toContain("CanvasEmptyState");
    expect(shellSource).not.toContain("Open threads in their own windows");
  });

  it("keeps old navigation chrome out of the sessions rail", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(railSource).not.toContain("SEARCH");
    expect(railSource).not.toContain("DEBUG");
    expect(railSource).not.toContain(
      "Projects, worktrees, and threads stay together in one focused",
    );
  });

  it("uses controlled repository customization visibility instead of hover-only CSS", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const customizationSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/project-customization-menu.tsx",
    );

    expect(railSource).toContain('side="right"');
    expect(railSource).toContain("customizationRepositoryId");
    expect(customizationSource).not.toContain("PencilLine");
    expect(customizationSource).not.toContain("group-hover:block");
  });

  it("keeps new worktree creation reachable from the sessions rail", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );

    expect(railSource).toContain("New worktree");
    expect(railSource).not.toContain("New session");
  });

  it("adds prompt input padding and suppresses the inner focus treatment", () => {
    const promptInputSource = readSource(
      "packages/ui/src/components/ui/prompt-input.tsx",
    );

    expect(promptInputSource).toContain("p-2");
    expect(promptInputSource).toContain("focus-visible:border-none");
    expect(promptInputSource).toContain("focus-visible:ring-0");
  });

  it("reloads providers when the model menu opens", () => {
    const dockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(dockSource).toContain("onModelMenuOpenChange");
    expect(controllerSource).toContain("void reload();");
  });

  it("removes the added sidecar/chat workspace/execute copy from visible chrome", () => {
    const dockSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );
    const activitySource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-activity-panel.tsx",
    );
    const chatSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/chat-thread-panel.tsx",
    );

    expect(dockSource).not.toContain("Chat workspace");
    expect(dockSource).not.toContain('"EXECUTE"');
    expect(dockSource).not.toContain("PromptSuggestionGroup");
    expect(surfacePanelSource).not.toContain("Sidecar");
    expect(activitySource).not.toContain("Current thread");
    expect(chatSource).not.toContain('label="Role"');
    expect(chatSource).not.toContain('label="Transcript"');
  });
});
