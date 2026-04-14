import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  ensureWorkspaceMode,
  focusChatThread,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

async function getActiveWorktreeId(
  page: import("@playwright/test").Page,
): Promise<string> {
  const activeWorktreeId = await page.evaluate(async () => {
    const shell = await window.piDesktop.shell.getSnapshot();
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
): Promise<string> {
  const threadId = await page.evaluate(async (nextWorktreeId) => {
    return window.piDesktop.threads.create(nextWorktreeId);
  }, worktreeId);

  await expect(page.getByTestId("thread-tabs")).toBeVisible();
  await expect
    .poll(async () => {
      const shell = await page.evaluate(async () => {
        const snapshot = await window.piDesktop.shell.getSnapshot();
        return {
          threadId: snapshot.catalog.selection.threadId,
          activeThreadTitle:
            snapshot.catalog.repositories[0]?.worktrees[0]?.threads[0]?.title ??
            null,
        };
      });

      return shell.threadId === threadId ? shell.activeThreadTitle : null;
    })
    .not.toBeNull();

  return threadId;
}

async function selectThread(
  page: import("@playwright/test").Page,
  threadId: string,
): Promise<void> {
  const selected = await page.evaluate(async (nextThreadId) => {
    await window.piDesktop.threads.select(nextThreadId);
    const snapshot = await window.piDesktop.shell.getSnapshot();
    return snapshot.catalog.selection.threadId;
  }, threadId);

  if (selected !== threadId) {
    throw new Error("Expected thread selection to persist");
  }
}

async function expectActiveThreadId(
  page: import("@playwright/test").Page,
  expectedThreadId: string,
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const snapshot = await window.piDesktop.shell.getSnapshot();
          return snapshot.catalog.selection.threadId;
        }),
      { timeout: 10_000 },
    )
    .toBe(expectedThreadId);
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
    `Pi Desktop mock assistant received: ${prompt}`,
    { timeout: 20_000 },
  );
}

test("keeps transcript data isolated per thread in the desktop app", async () => {
  test.setTimeout(90_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-thread-isolation-",
  );

  const alphaPrompt = "Thread alpha only says ALPHA-THREAD-DATA";
  const betaPrompt = "Thread beta only says BETA-THREAD-DATA";

  try {
    await waitForAppReady(page);
    await ensureWorkspaceMode(page);

    const activeWorktreeId = await getActiveWorktreeId(page);

    const alphaThreadId = await createNamedThread(page, activeWorktreeId);
    await selectThread(page, alphaThreadId);
    await expectActiveThreadId(page, alphaThreadId);
    await sendPrompt(page, alphaPrompt);

    const betaThreadId = await createNamedThread(page, activeWorktreeId);
    await selectThread(page, betaThreadId);
    await expectActiveThreadId(page, betaThreadId);
    await sendPrompt(page, betaPrompt);

    await selectThread(page, alphaThreadId);
    await expectActiveThreadId(page, alphaThreadId);
    await expect(page.getByTestId("chat-transcript")).toContainText(
      alphaPrompt,
    );
    await expect(page.getByTestId("chat-transcript")).toContainText(
      `Pi Desktop mock assistant received: ${alphaPrompt}`,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      betaPrompt,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      `Pi Desktop mock assistant received: ${betaPrompt}`,
    );

    await selectThread(page, betaThreadId);
    await expectActiveThreadId(page, betaThreadId);
    await expect(page.getByTestId("chat-transcript")).toContainText(betaPrompt);
    await expect(page.getByTestId("chat-transcript")).toContainText(
      `Pi Desktop mock assistant received: ${betaPrompt}`,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      alphaPrompt,
    );
    await expect(page.getByTestId("chat-transcript")).not.toContainText(
      `Pi Desktop mock assistant received: ${alphaPrompt}`,
    );
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
