import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("workspace surface behavior", () => {
  it("keeps the left rail project switcher minimal", () => {
    const railSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
    const switcherSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/repository-switcher.tsx",
    );

    expect(railSource).not.toContain("Show all projects");
    expect(switcherSource).not.toContain("ChevronDown");
    expect(switcherSource).not.toContain(
      "border border-[#474747]/30 bg-[#0e0e0e]",
    );
    expect(switcherSource).not.toContain("<Button");
  });

  it("keeps the contextual workspace surface in the dedicated right panel", () => {
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(shellSource).toContain("renderRightPanelContent");
    expect(shellSource).toContain("<WorkspaceSurfacePanel");
    expect(shellSource).toContain("isRightPanelVisible");
    expect(shellSource).toContain("w-[300px] xl:w-[400px] opacity-100");
    expect(surfacePanelSource).toContain("bg-transparent");
    expect(surfacePanelSource).not.toContain("w-[min(28rem,30vw)]");
  });

  it("removes the activity tab from the workspace surface chrome", () => {
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );

    expect(surfacePanelSource).not.toContain("onSelectActivity");
    expect(surfacePanelSource).not.toContain(">Activity<");
    expect(surfacePanelSource).not.toContain("Activity className");
  });

  it("removes project notes from the workspace surface router", () => {
    const surfacePanelSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-surface-panel.tsx",
    );
    const titleBarSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );

    expect(surfacePanelSource).not.toContain("WorkspaceNoteContent");
    expect(surfacePanelSource).not.toContain('selectedWindow.kind === "note"');
    expect(titleBarSource).not.toContain("Open notes");
  });
});
