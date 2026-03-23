import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
} from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "../../..");
export const desktopMainEntry = path.join(
  repoRoot,
  "apps/desktop/out/main/index.js",
);

export interface LaunchContext {
  homeDir: string;
  userDataDir: string;
  cleanup(): void;
}

export interface DesktopLaunch {
  app: ElectronApplication;
  page: Page;
  launchContext: LaunchContext;
}

export function createLaunchContext(
  prefix: string,
  options?: Partial<Pick<LaunchContext, "homeDir" | "userDataDir">>,
): LaunchContext {
  const homeDir =
    options?.homeDir ?? fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const userDataDir =
    options?.userDataDir ?? path.join(homeDir, ".pidesk-test-user-data");

  fs.mkdirSync(userDataDir, { recursive: true });

  return {
    homeDir,
    userDataDir,
    cleanup() {
      fs.rmSync(homeDir, { recursive: true, force: true });
    },
  };
}

export async function launchDesktopApp(
  prefix: string,
  options?: {
    homeDir?: string;
    userDataDir?: string;
    env?: Record<string, string>;
  },
): Promise<DesktopLaunch> {
  const launchContext = createLaunchContext(prefix, {
    homeDir: options?.homeDir,
    userDataDir: options?.userDataDir,
  });

  const app = await electron.launch({
    args: [desktopMainEntry],
    cwd: repoRoot,
    env: {
      ...process.env,
      ...options?.env,
      ELECTRON_RENDERER_URL: "",
      HOME: launchContext.homeDir,
      NODE_ENV: "test",
      PIDESK_AGENT_MODE: "mock",
      PIDESK_HEADLESS: "1",
      PIDESK_USER_DATA_DIR: launchContext.userDataDir,
    },
  });

  const page = await app.firstWindow();

  return {
    app,
    page,
    launchContext,
  };
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");

  await expect
    .poll(
      async () => {
        try {
          return await page.getByTestId("app-ready").count();
        } catch {
          return 0;
        }
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await expect(page.getByTestId("app-ready")).toBeVisible();
  await expect(page.getByTestId("titlebar-project-name")).toHaveText("PiDesk");
  await expect(page.getByTestId("chat-first-layout")).toBeVisible();
}

export async function ensureWorkspaceMode(page: Page): Promise<void> {
  const firstProject = page.getByTestId("project-rail-item").first();
  await expect(firstProject).toBeVisible();
}

export async function focusChatThread(page: Page): Promise<void> {
  await ensureWorkspaceMode(page);

  await page.getByTestId("current-thread-title").click();
  await expect(page.getByTestId("chat-input")).toBeVisible();
}

export function getWorkspaceContextPanel(page: Page) {
  return page.getByTestId("workspace-context-panel").first();
}

export function getWorkspacePrimarySurface(page: Page) {
  return page.getByTestId("workspace-context-panel").first();
}

export function getContextPanelAction(page: Page, name: string) {
  const actionNames: Record<string, string> = {
    Launcher: "Open launcher",
    Files: "Browse files",
    Terminal: "Open terminal",
    Git: "Open git",
    Activity: "Open activity",
    Settings: "Open settings",
  };

  return page.getByRole("button", {
    name: actionNames[name] ?? name,
  });
}

export function getCurrentBranchName(): string {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

export function removeWorktree(
  repositoryPath: string,
  worktreePath: string,
  branchName: string,
): void {
  spawnSync("git", ["worktree", "remove", "-f", worktreePath], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
  spawnSync("git", ["branch", "-D", branchName], {
    cwd: repositoryPath,
    encoding: "utf8",
  });
}
