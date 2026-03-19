import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("chunk3 architecture", () => {
  it("keeps chat/file/note/search routing store-backed without threading agent props", () => {
    const routerSource = readSource(
      "apps/desktop/src/renderer/src/components/canvas/window-content-router.tsx",
    );
    const shellSource = readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );

    expect(routerSource).not.toContain("agent: ThreadConversationState");
    expect(routerSource).not.toContain("? agent");
    expect(shellSource).not.toContain("agent: AgentState");
    expect(shellSource).not.toContain("agent={agent}");
  });

  it("delegates workspace session mechanics out of app.tsx", () => {
    const appSource = readSource("apps/desktop/src/renderer/src/app.tsx");

    expect(appSource).toContain("./hooks/use-app-shell-controller");
    expect(appSource).toContain("const controller = useAppShellController()");
    expect(appSource).not.toContain("const {\n    reload,");
    expect(appSource).not.toContain(
      "const { state: windowState, store: windowStore } = useWindowStore()",
    );
    expect(appSource).not.toContain("syncActiveThreadConversation(");
    expect(appSource).not.toContain("openFileWindowForWorktree(");
    expect(appSource).not.toContain("updateSearchWindowQueryForWorktree(");
    expect(appSource).not.toContain("loadPromptAutocompleteSuggestions(");
    expect(appSource).not.toContain("planPromptDispatch(");
    expect(appSource).not.toContain(
      "const setThreadConversationForWorktree = React.useCallback",
    );
    expect(appSource).not.toContain(
      "const setFileContentForWorktree = React.useCallback",
    );
    expect(appSource).not.toContain(
      "const setSearchUiStateForWorktree = React.useCallback",
    );
    expect(appSource).not.toContain(
      "const getFileContentState = React.useCallback",
    );
    expect(appSource).not.toContain(
      "const getNoteContentState = React.useCallback",
    );
    expect(appSource).not.toContain(
      "const getSearchUiState = React.useCallback",
    );
  });
});
