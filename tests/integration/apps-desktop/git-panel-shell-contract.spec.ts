import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("git panel shell contract", () => {
  it("passes the active worktree and repository path into the default right sidebar", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(shellSource).toContain("worktree={activeWorktree}");
    expect(shellSource).toContain("shellGit={shellGit}");
    expect(shellSource).toContain("repositoryPath={");
    expect(shellSource).toContain("activeWorktree?.path ??");
    expect(shellSource).toContain("activeRepository?.rootPath ??");
    expect(controllerSource).toContain("shellGit: shell.git ?? null");
  });

  it("persists lightweight workspace switch state without forcing a renderer reload", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(controllerSource).toContain("WORKSPACE_SWITCH_STATE_KEY");
    expect(controllerSource).toContain("showWorkspaceSwitchLoader(");
    expect(controllerSource).not.toContain("window.location.reload()");
  });

  it("removes the old post-reload workspace switch toast path", () => {
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");

    expect(appSource).not.toContain("pidesk.workspace-switch-notice");
    expect(appSource).not.toContain("Project switched");
  });

  it("shows a fullscreen workspace switch loader during in-app navigation", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");

    expect(controllerSource).toContain("pidesk.workspace-switch-state");
    expect(controllerSource).toContain("workspaceSwitchingRepositoryName");
    expect(appSource).toContain("workspace-switch-loader");
    expect(appSource).toContain("controller.workspaceSwitchingRepositoryName");
    expect(appSource).toContain("WORKSPACE_SWITCH_STATE_KEY");
  });
});
