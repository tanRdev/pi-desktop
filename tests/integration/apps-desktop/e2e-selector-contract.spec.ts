import { readFileSync } from "node:fs";
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
    expect(leftRailSource).toContain('data-testid="project-rail-item"');
    expect(surfacePanelSource).toContain(
      'data-testid="workspace-context-panel"',
    );
    expect(surfacePanelSource).toContain('testId: "sidecar-action-launcher"');
    expect(surfacePanelSource).toContain('testId: "sidecar-action-files"');
  });

  it("adds stable settings and window chrome selectors for e2e flows", () => {
    const settingsModalSource = readSource(
      "apps/desktop/src/renderer/src/components/settings/settings-modal.tsx",
    );
    const aiSettingsSource = readSource(
      "apps/desktop/src/renderer/src/components/settings/sections/ai-settings.tsx",
    );
    const interfaceSettingsSource = readSource(
      "apps/desktop/src/renderer/src/components/settings/sections/interface-settings.tsx",
    );
    const formComponentsSource = readSource(
      "apps/desktop/src/renderer/src/components/settings/form-components.tsx",
    );
    const workspaceShellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const workspaceSurfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(settingsModalSource).toContain('data-testid="settings-modal"');
    expect(settingsModalSource).toContain(
      `data-testid={\`settings-nav-\${item.id}\`}`,
    );
    expect(aiSettingsSource).toContain('testId="settings-provider-select"');
    expect(aiSettingsSource).toContain('testId="settings-model-select"');
    expect(interfaceSettingsSource).toContain(
      'testId="settings-sidebar-width-slider"',
    );
    expect(formComponentsSource).toContain("testId?: string");
    expect(workspaceShellSource).toContain('data-testid="chat-first-layout"');
    expect(workspaceSurfacePanelSource).toContain(
      'data-testid="workspace-context-panel"',
    );
  });
});
