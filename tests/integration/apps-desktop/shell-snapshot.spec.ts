import { describe, expect, it } from "vitest";

import { createShellSnapshot } from "../../../apps/desktop/src/main/shell-snapshot";

describe("createShellSnapshot", () => {
  it("builds runtime, workspace, and capability metadata for the shell", () => {
    const snapshot = createShellSnapshot({
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      electronVersion: "41.0.1",
      platform: "darwin",
      env: { NODE_ENV: "test" },
      isPackaged: false,
      cwd: "/Users/tester/Dev/PiDesk",
      agentDir: "/Users/tester/Dev/PiDesk/.pidesk-agent",
      agentMode: "mock",
    });

    expect(snapshot).toMatchObject({
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      mode: "test",
      platform: "darwin",
      runtime: {
        agentMode: "mock",
        electronVersion: "41.0.1",
      },
      workspace: {
        rootPath: "/Users/tester/Dev/PiDesk",
        agentDirectory: "/Users/tester/Dev/PiDesk/.pidesk-agent",
        projects: [
          {
            id: "/Users/tester/Dev/PiDesk",
            name: "PiDesk",
            path: "/Users/tester/Dev/PiDesk",
            isActive: true,
          },
        ],
      },
      capabilities: {
        supportsTurns: true,
        supportsTools: true,
        supportsActivity: true,
        supportsParallelSessions: false,
      },
    });

    expect(snapshot.git).toBeDefined();
    expect(["repository", "not_repo", "unavailable"]).toContain(
      snapshot.git?.status,
    );
  });
});
