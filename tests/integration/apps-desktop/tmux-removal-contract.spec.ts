import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("tmux removal contract", () => {
  it("removes tmux and pi-linked backends from shared terminal models", () => {
    const terminalModelSource = readSource(
      "packages/shared/src/models/terminal.ts",
    );
    const windowModelSource = readSource(
      "packages/shared/src/models/window.ts",
    );

    expect(terminalModelSource).toContain(
      'export type TerminalBackend = "shell" | "lazygit"',
    );
    expect(terminalModelSource).not.toContain("pi-linked");
    expect(terminalModelSource).not.toContain("tmux");
    expect(windowModelSource).not.toContain("tmuxSessionName");
    expect(windowModelSource).not.toContain("pi-linked");
    expect(windowModelSource).not.toContain("tmux-attach");
  });

  it("removes tmux runtime bootstrapping from the desktop main process", () => {
    const indexSource = readSource("apps/desktop/src/main/index.ts");
    const launchSource = readSource(
      "apps/desktop/src/main/thread-runtime-launch.ts",
    );

    expect(indexSource).not.toContain("TmuxThreadRuntimeManager");
    expect(indexSource).not.toContain("routePromptToTerminal");
    expect(launchSource).not.toContain("createTmuxThreadSessionName");
    expect(launchSource).not.toContain("sessionName");
  });

  it("deletes legacy tmux implementation files", () => {
    const mainDirectory = readSource("apps/desktop/src/main/index.ts");

    expect(mainDirectory).not.toContain("./tmux-thread-runtime-manager");
    expect(mainDirectory).not.toContain("./tmux-session-naming");
  });

  it("removes tmux-only terminal launch helpers from the main process", () => {
    const terminalManagerSource = readSource(
      "apps/desktop/src/main/terminal-manager.ts",
    );
    const payloadParserSource = readSource(
      "apps/desktop/src/main/ipc/payload-parsers.ts",
    );

    expect(terminalManagerSource).not.toContain("buildTmuxLaunchSpec");
    expect(terminalManagerSource).not.toContain("hasTmux");
    expect(terminalManagerSource).not.toContain("tmuxBinary");
    expect(payloadParserSource).not.toContain("pi-linked");
    expect(payloadParserSource).not.toContain("tmux-attach");
  });
});
