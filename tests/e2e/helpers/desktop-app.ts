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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isClosedTargetError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Target page, context or browser has been closed")
  );
}

function getAppProcessId(app: ElectronApplication): number | null {
  if (typeof app.process !== "function") {
    return null;
  }

  const childProcess = app.process();
  return typeof childProcess?.pid === "number" ? childProcess.pid : null;
}

function isProcessAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(
  processId: number | null,
  timeoutMs: number,
): Promise<boolean> {
  if (processId === null) {
    await delay(timeoutMs);
    return false;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(processId)) {
      return true;
    }

    await delay(100);
  }

  return !isProcessAlive(processId);
}

async function attemptPlaywrightClose(
  app: ElectronApplication,
  timeoutMs: number,
): Promise<boolean> {
  const timeoutToken = Symbol("timeout");
  const result = await Promise.race([
    app.close().then(
      () => true,
      (error: unknown) => {
        if (isClosedTargetError(error)) {
          return true;
        }

        return false;
      },
    ),
    delay(timeoutMs).then(() => timeoutToken),
  ]);

  return result === true;
}

async function requestAppShutdown(
  app: ElectronApplication,
  mode: "quit" | "exit",
): Promise<boolean> {
  return app
    .evaluate(async ({ app: electronApp }, shutdownMode) => {
      if (shutdownMode === "quit") {
        electronApp.quit();
        return;
      }

      electronApp.exit(0);
    }, mode)
    .then(
      () => true,
      (error: unknown) => isClosedTargetError(error),
    );
}

export async function closeDesktopApp(app: ElectronApplication): Promise<void> {
  const processId = getAppProcessId(app);

  if (
    (await attemptPlaywrightClose(app, 2_000)) ||
    (await waitForProcessExit(processId, 2_000))
  ) {
    return;
  }

  await requestAppShutdown(app, "quit");

  if (await waitForProcessExit(processId, 5_000)) {
    return;
  }

  await requestAppShutdown(app, "exit");

  if (await waitForProcessExit(processId, 5_000)) {
    return;
  }

  if (processId !== null) {
    try {
      process.kill(processId, "SIGKILL");
    } catch {
      // The process may have already exited between checks.
    }
  }

  await waitForProcessExit(processId, 5_000);

  void attemptPlaywrightClose(app, 1_000);
}

export function createLaunchContext(
  prefix: string,
  options?: Partial<Pick<LaunchContext, "homeDir" | "userDataDir">>,
): LaunchContext {
  const homeDir =
    options?.homeDir ?? fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const userDataDir =
    options?.userDataDir ?? path.join(homeDir, ".pi-desktop-test-user-data");

  fs.mkdirSync(userDataDir, { recursive: true });

  return {
    homeDir,
    userDataDir,
    cleanup() {
      fs.rmSync(homeDir, { recursive: true, force: true });
    },
  };
}

async function isDesktopWindow(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");

  if (title === "Pi Desktop") {
    return true;
  }

  if (title === "DevTools") {
    return false;
  }

  return page
    .getByTestId("app-ready")
    .count()
    .then((count) => count > 0)
    .catch(() => false);
}

async function resolveDesktopPage(app: ElectronApplication): Promise<Page> {
  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if (await isDesktopWindow(page)) {
            return true;
          }
        }

        return false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  for (const page of app.windows()) {
    if (await isDesktopWindow(page)) {
      return page;
    }
  }

  throw new Error("Failed to locate the Pi Desktop window");
}

export async function launchDesktopApp(
  prefix: string,
  options?: {
    homeDir?: string;
    userDataDir?: string;
    env?: Record<string, string>;
    agentMode?: "mock" | "cli";
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
      PI_DESKTOP_AGENT_MODE: options?.agentMode ?? "mock",
      PI_DESKTOP_HEADLESS: "1",
      PI_DESKTOP_USER_DATA_DIR: launchContext.userDataDir,
    },
  });

  const page = await resolveDesktopPage(app);

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
      () =>
        page
          .getByTestId("app-ready")
          .count()
          .then(
            (count) => count,
            () => 0,
          ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await expect(page.getByTestId("app-ready")).toBeVisible();
  await expect(page.getByTestId("chat-first-layout")).toBeVisible();
  await expect(page.getByTestId("left-rail")).toBeVisible();
}

export async function ensureWorkspaceMode(page: Page): Promise<void> {
  await expect(page.getByTestId("left-rail")).toBeVisible();
}

export async function focusChatThread(page: Page): Promise<void> {
  await ensureWorkspaceMode(page);

  await expect(page.getByTestId("chat-input")).toBeVisible();
}

export async function createThreadFromRail(page: Page): Promise<void> {
  await ensureWorkspaceMode(page);

  await expect(page.getByTestId("thread-tabs")).toBeVisible();
  await page.getByTestId("create-thread-button").click();
}

export function getWorkspaceContextPanel(page: Page) {
  return page.getByTestId("workspace-context-panel").first();
}

export function getWorkspacePrimarySurface(page: Page) {
  return page.getByTestId("workspace-context-panel").first();
}

export function getContextPanelAction(page: Page, name: string) {
  const actionNames: Record<string, string> = {
    Launcher: "Toggle side panel",
    Files: "Browse files",
    Terminal: "Open terminal",
    Git: "Open git",
    Activity: "Open activity",
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
