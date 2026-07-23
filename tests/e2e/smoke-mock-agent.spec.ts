import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const ROOT = path.resolve(__dirname, "../..");
const DESKTOP = path.join(ROOT, "apps/desktop");
const MAIN_ENTRY = path.join(DESKTOP, "out/main/index.js");

test.describe("Pi Desktop raised-bar smoke (mock agent)", () => {
  test.beforeAll(() => {
    test.skip(
      !fs.existsSync(MAIN_ENTRY),
      `Build desktop first: missing ${MAIN_ENTRY}`,
    );
  });

  test("launch app → add Repository → create Worktree → prompt on mock runtime", async () => {
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "pi-desktop-e2e-"),
    );
    const fixtureRepo = fs.mkdtempSync(path.join(os.tmpdir(), "pi-e2e-repo-"));

    const { execSync } = await import("node:child_process");
    execSync("git init", { cwd: fixtureRepo });
    execSync('git config user.email "e2e@pi.desktop"', { cwd: fixtureRepo });
    execSync('git config user.name "E2E"', { cwd: fixtureRepo });
    fs.writeFileSync(path.join(fixtureRepo, "README.md"), "# e2e\n");
    execSync("git add README.md && git commit -m init", { cwd: fixtureRepo });

    const app = await electron.launch({
      args: [MAIN_ENTRY],
      env: {
        ...process.env,
        NODE_ENV: "test",
        PI_DESKTOP_AGENT_MODE: "mock",
        PI_DESKTOP_USER_DATA_DIR: userDataDir,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      },
    });

    try {
      const window = await app.firstWindow({ timeout: 60_000 });
      await window.waitForLoadState("domcontentloaded");
      await expect(window.locator("body")).toBeVisible();

      const result = await window.evaluate(async (repoPath) => {
        const api = (
          window as unknown as {
            piDesktop: {
              repositories: {
                add: (path: string) => Promise<{ id: string } | null>;
              };
              worktrees: {
                create: (
                  repositoryId: string,
                  branchName: string,
                ) => Promise<{ path: string } | null>;
              };
              agent: {
                prompt: (text: string) => Promise<void>;
                getSnapshot: () => Promise<{ status: string }>;
              };
            };
          }
        ).piDesktop;

        const repository = await api.repositories.add(repoPath);
        if (!repository?.id) {
          throw new Error("repositories.add did not return a repository id");
        }

        const worktree = await api.worktrees.create(
          repository.id,
          `e2e-feature-${Date.now()}`,
        );
        if (!worktree?.path) {
          throw new Error("worktrees.create did not return a worktree path");
        }

        await api.agent.prompt("hello from playwright smoke");
        const snapshot = await api.agent.getSnapshot();
        return {
          repositoryId: repository.id,
          worktreePath: worktree.path,
          status: snapshot.status,
        };
      }, fixtureRepo);

      expect(result.repositoryId).toBeTruthy();
      expect(result.worktreePath).toBeTruthy();
      expect(["ready", "streaming", "idle", "starting", "error"]).toContain(
        result.status,
      );
    } finally {
      await app.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
      fs.rmSync(fixtureRepo, { recursive: true, force: true });
    }
  });
});
