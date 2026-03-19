import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("chunk4 architecture", () => {
  it("threads repository customization actions through the renderer shell", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );
    const hookSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-shell-model.ts",
    );
    const storeSource = readSource(
      "apps/desktop/src/renderer/src/stores/app-shell-store.ts",
    );
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");

    expect(storeSource).toContain("updateRepositoryPreferences(");
    expect(storeSource).toContain("api.state.updateRepositoryPreferences(");
    expect(hookSource).toContain("updateRepositoryPreferences:");
    expect(hookSource).toContain(
      "store.getState().updateRepositoryPreferences",
    );
    expect(controllerSource).toContain("updateRepositoryPreferences,");
    expect(controllerSource).toContain(
      "onUpdateRepositoryPreferences: updateRepositoryPreferences",
    );
    expect(shellSource).toContain("onUpdateRepositoryPreferences");
    expect(shellSource).toContain(
      "onUpdateRepositoryPreferences={onUpdateRepositoryPreferences}",
    );
    expect(appSource).toContain("useAppShellController");
    expect(appSource).toContain("controller.workspaceShellProps");
  });

  it("keeps repository customization on the rail while removing the old sidebar header chrome", () => {
    const titleBarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );
    const leftRailSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const leftSidebarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );
    const avatarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/project-avatar.tsx",
    );
    const customizationSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/project-customization-menu.tsx",
    );
    const iconPickerSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/project-icon-picker.tsx",
    );

    expect(titleBarSource).toContain("activeRepository");
    expect(titleBarSource).not.toContain('className="w-16"');
    expect(leftRailSource).toContain("ProjectCustomizationMenu");
    expect(leftSidebarSource).not.toContain("ProjectCustomizationMenu");
    expect(customizationSource).toContain("updateRepositoryPreferences");
    expect(customizationSource).toContain("accentColor");
    expect(iconPickerSource).toContain("PROJECT_ICON_OPTIONS");
    expect(avatarSource).not.toContain("bg-rose-500");
    expect(avatarSource).not.toContain("bg-orange-500");
    expect(avatarSource).not.toContain("bg-amber-500");
    expect(avatarSource).not.toContain("bg-emerald-500");
    expect(avatarSource).not.toContain("bg-cyan-500");
    expect(avatarSource).not.toContain("bg-blue-500");
    expect(avatarSource).not.toContain("bg-violet-500");
    expect(avatarSource).not.toContain("bg-fuchsia-500");
    expect(avatarSource).not.toContain("bg-pink-500");
  });

  it("removes dead archived chrome, keeps hover customization seamless, and labels fields accessibly", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const leftSidebarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );
    const titleBarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );
    const avatarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/project-avatar.tsx",
    );
    const customizationSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/project-customization-menu.tsx",
    );

    expect(shellSource).not.toContain("onShowArchived={() => {}}");
    expect(leftSidebarSource).not.toContain("Archived");
    expect(shellSource).not.toContain("backdrop-blur-sm");
    expect(titleBarSource).toContain('aria-label="Open launcher"');
    expect(titleBarSource).toContain('aria-label="Toggle files sidebar"');
    expect(titleBarSource).toContain('aria-label="Open git view"');
    expect(titleBarSource).toContain('aria-label="Open notes"');
    expect(titleBarSource).toContain('aria-label="Open terminal"');
    const repositoryNameExpression = `${"$"}{displayName}`;
    expect(avatarSource).toContain(
      `aria-label={\`Open repository ${repositoryNameExpression}\`}`,
    );
    expect(customizationSource).toContain(
      `aria-label={\`Customize ${"$"}{repository.name}\`}`,
    );
    expect(customizationSource).not.toContain("group-hover:block");
    expect(customizationSource).not.toContain("group-focus-within:block");
    expect(customizationSource).toContain("pointer-events-none");
    expect(customizationSource).toContain('htmlFor="project-custom-name"');
    expect(customizationSource).toContain('id="project-custom-name"');
    expect(customizationSource).toContain('aria-label="Project display name"');
  });
});
