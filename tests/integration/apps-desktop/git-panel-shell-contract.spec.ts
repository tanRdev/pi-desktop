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

  it("persists a one-shot workspace switch notice before forcing a reload", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );

    expect(controllerSource).toContain("persistWorkspaceSwitchNotice(");
    expect(controllerSource).toContain("WORKSPACE_SWITCH_NOTICE_KEY");
    expect(controllerSource).toContain("reloadForWorkspaceSwitch(");
    expect(controllerSource).toContain("window.location.reload()");
  });

  it("shows the persisted workspace switch toast after reload", () => {
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");

    expect(appSource).toContain("pidesk.workspace-switch-notice");
    expect(appSource).toContain("toast.success(");
    expect(appSource).toContain("Project switched");
  });

  it("shows a fullscreen workspace switch loader before and after reload", () => {
    const controllerSource = readSource(
      "apps/desktop/src/renderer/src/hooks/use-app-shell-controller.ts",
    );
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");

    expect(controllerSource).toContain("pidesk.workspace-switch-state");
    expect(controllerSource).toContain("workspaceSwitchingRepositoryName");
    expect(controllerSource).toContain("window.setTimeout");
    expect(appSource).toContain("workspace-switch-loader");
    expect(appSource).toContain("controller.workspaceSwitchingRepositoryName");
    expect(appSource).toContain("WORKSPACE_SWITCH_STATE_KEY");
  });
});
