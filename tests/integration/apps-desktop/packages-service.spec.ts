import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackagesServiceImpl } from "../../../apps/desktop/src/main/packages/packages-service-impl";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe("packages-service", () => {
  it("infers installed package scope from global and local settings", async () => {
    const homePath = createTempDir("pi-desktop-packages-home-");
    const worktreePath = createTempDir("pi-desktop-packages-worktree-");
    mkdirSync(path.join(homePath, ".pi", "agent"), { recursive: true });
    mkdirSync(path.join(worktreePath, ".pi"), { recursive: true });
    writeFileSync(
      path.join(homePath, ".pi", "agent", "settings.json"),
      JSON.stringify({ packages: ["npm:@acme/global-tools"] }),
      "utf8",
    );
    writeFileSync(
      path.join(worktreePath, ".pi", "settings.json"),
      JSON.stringify({ packages: ["npm:@acme/local-tools"] }),
      "utf8",
    );

    const cli = {
      run: vi.fn(async () => ({
        exitCode: 0,
        stdout: [
          "User packages:",
          "  npm:@acme/global-tools",
          "    /Users/test/.pi/npm/global-tools",
          "Project packages:",
          "  npm:@acme/local-tools",
          "    /tmp/worktree/.pi/npm/local-tools",
        ].join("\n"),
        stderr: "",
      })),
    };
    const catalogClient = {
      search: vi.fn(),
      getDetail: vi.fn(),
    };

    const service = new PackagesServiceImpl({
      homePath,
      getLocalSettingsPath: () =>
        path.join(worktreePath, ".pi", "settings.json"),
      getLocalWorkingDirectory: () => worktreePath,
      emit: () => undefined,
      cli,
      catalogClient,
    });

    const installed = await service.listInstalled();

    expect(installed).toEqual([
      expect.objectContaining({
        name: "@acme/global-tools",
        scope: "global",
      }),
      expect.objectContaining({
        name: "@acme/local-tools",
        scope: "local",
      }),
    ]);
  });

  it("fails local installs when there is no active worktree", async () => {
    const homePath = createTempDir("pi-desktop-packages-home-");
    const cli = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
    };
    const catalogClient = {
      search: vi.fn(),
      getDetail: vi.fn(),
    };
    const emittedEvents: unknown[] = [];

    const service = new PackagesServiceImpl({
      homePath,
      getLocalSettingsPath: () => null,
      getLocalWorkingDirectory: () => null,
      emit: (event) => {
        emittedEvents.push(event);
      },
      cli,
      catalogClient,
    });

    const operation = await service.install({
      packageName: "@acme/local-tools",
      scope: "local",
    });

    expect(operation.status).toBe("failed");
    expect(operation.message).toContain("active worktree");
    expect(cli.run).not.toHaveBeenCalledWith(
      expect.arrayContaining(["install"]),
      homePath,
    );
    expect(emittedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "operation_updated",
        }),
      ]),
    );
  });
});
