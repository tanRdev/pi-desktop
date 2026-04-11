import { expect, type Locator, test } from "@playwright/test";
import {
  ensureWorkspaceMode,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

async function getActiveWorktreeId(
  page: import("@playwright/test").Page,
): Promise<string> {
  const activeWorktreeId = await page.evaluate(async () => {
    const shell = await window.pidesk.shell.getSnapshot();
    return shell.catalog.selection.worktreeId;
  });

  if (!activeWorktreeId) {
    throw new Error("Expected an active worktree to be selected");
  }

  return activeWorktreeId;
}

async function createNamedThread(
  page: import("@playwright/test").Page,
  worktreeId: string,
  title: string,
): Promise<Locator> {
  await page.evaluate(
    async ({ nextWorktreeId, nextTitle }) => {
      await window.pidesk.threads.create(nextWorktreeId, nextTitle);
    },
    { nextWorktreeId: worktreeId, nextTitle: title },
  );

  const rail = page.getByTestId("left-rail");
  await expect(rail).toContainText(title, { timeout: 10_000 });

  const thread = rail.getByRole("button", { name: title }).first();
  await expect(thread).toBeVisible();
  return thread;
}

async function selectThread(thread: Locator): Promise<void> {
  await thread.click();
  await thread.press("Enter");
}

async function sendPrompt(
  page: import("@playwright/test").Page,
  prompt: string,
): Promise<void> {
  await focusChatThread(page);
  await page.getByTestId("chat-input").fill(prompt);
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("chat-transcript")).toContainText(prompt, {
    timeout: 20_000,
  });
  await expect(page.getByTestId("chat-transcript")).toContainText(
    `PiDesk mock assistant received: ${prompt}`,
    { timeout: 20_000 },
  );
}

test("keeps transcript data isolated per thread in the desktop app", async () => {
  test.setTimeout(90_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pidesk-e2e-thread-isolation-",
  );

  const alphaPrompt = "Thread alpha only says ALPHA-THREAD-DATA";
  const betaPrompt = "Thread beta only says BETA-THREAD-DATA";

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    const activeWorktreeId = await getActiveWorktreeId(page);

    const alphaThread = await createNamedThread(
      page,
      activeWorktreeId,
      "Thread Alpha",
    );
    await selectThread(alphaThread);
    await expect(page.getByTestId("left-rail")).toContainText("Thread Alpha");
    await sendPrompt(page, alphaPrompt);

    const betaThread = await createNamedThread(
      page,
      activeWorktreeId,
      "Thread Beta",
    );
    await selectThread(betaThread);
    await expect(page.getByTestId("left-rail")).toContainText("Thread Beta");
    await sendPrompt(page, betaPrompt);

    await selectThread(alphaThread);
    await expect(page.getByTestId("left-rail")).toContainText("Thread Alpha");
    await expect(page.getByTestId("chat-transcript")).toContainText(
      alphaPrompt,
    );
    await expect(page.getByTestId("chat-transcript")).toContainText(
      `PiDesk mock assistant received: ${alphaPrompt}`,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      betaPrompt,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      `PiDesk mock assistant received: ${betaPrompt}`,
    );

    await selectThread(betaThread);
    await expect(page.getByTestId("left-rail")).toContainText("Thread Beta");
    await expect(page.getByTestId("chat-transcript")).toContainText(betaPrompt);
    await expect(page.getByTestId("chat-transcript")).toContainText(
      `PiDesk mock assistant received: ${betaPrompt}`,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      alphaPrompt,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      `PiDesk mock assistant received: ${alphaPrompt}`,
    );
  } finally {
    await app.close();
    launchContext.cleanup();
  }
});
