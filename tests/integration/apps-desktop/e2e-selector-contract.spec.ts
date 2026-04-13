import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("e2e selector contract", () => {
  it("adds stable app shell selectors for current project, worktree, and runtime status", () => {
    const titleBarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );
    const leftRailSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );
    expect(titleBarSource).toContain('data-testid="titlebar-project-name"');
    expect(leftRailSource).toContain('data-testid="left-rail"');
    expect(leftRailSource).toContain('data-mode="workspace"');
    expect(surfacePanelSource).toContain(
      'data-testid="workspace-context-panel"',
    );
    expect(titleBarSource).toContain('data-slot="titlebar-controls"');
    expect(titleBarSource).toContain('label: "Open terminal"');
    expect(titleBarSource).toContain('aria-label="Toggle side panel"');
    expect(titleBarSource).not.toContain("Browse files");
    expect(titleBarSource).not.toContain("Open git");
  });

  it("keeps dialog state and mounted package management surface aligned with the app shell", () => {
    const packagesModalPath = path.resolve(
      process.cwd(),
      "apps/desktop/src/renderer/src/components/packages/packages-modal.tsx",
    );
    const storeSource = readSource(
      "apps/desktop/src/renderer/src/stores/ui-interaction-store.ts",
    );
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");
    const workspaceShellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const workspaceSurfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(storeSource).toContain("settings: boolean");
    expect(storeSource).toContain("packages: boolean");
    expect(existsSync(packagesModalPath)).toBe(true);
    expect(appSource).toContain("<PackagesModal");
    expect(appSource).toContain("open={controller.isPackagesOpen}");
    expect(appSource).toContain("onOpenChange={controller.setPackagesOpen}");
    expect(workspaceShellSource).toContain('data-testid="chat-first-layout"');
    expect(workspaceSurfacePanelSource).toContain(
      'data-testid="workspace-context-panel"',
    );
  });
});
