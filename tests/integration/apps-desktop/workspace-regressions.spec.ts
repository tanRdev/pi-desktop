import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("workspace regressions", () => {
  it("replaces the old empty canvas copy with an embedded canvas guide", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(shellSource).toContain("CanvasEmptyState");
    expect(shellSource).not.toContain("Open threads in their own windows");
  });

  it("removes the repository summary header from the left sidebar", () => {
    const sidebarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );

    expect(sidebarSource).not.toContain("ProjectAvatar");
    expect(sidebarSource).not.toContain("ProjectCustomizationMenu");
    expect(sidebarSource).not.toContain("repository.defaultBranch");
  });

  it("uses controlled repository customization visibility instead of hover-only CSS", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const customizationSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/project-customization-menu.tsx",
    );

    expect(railSource).toContain('side="right"');
    expect(railSource).toContain("open={");
    expect(customizationSource).not.toContain("PencilLine");
    expect(customizationSource).not.toContain("group-hover:block");
    expect(customizationSource).toContain("pointer-events-none");
  });

  it("renames the left sidebar footer action to New worktree", () => {
    const sidebarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );

    expect(sidebarSource).toContain("New worktree");
    expect(sidebarSource).not.toContain("New session");
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
});
