import { expect, test } from "@playwright/test";
import {
  closeDesktopApp,
  launchDesktopApp,
  waitForAppReady,
} from "./helpers/desktop-app";

type BenchmarkSummary = {
  createThreadMs: number[];
  switchThreadMs: number[];
  sendMessageMs: number[];
  shellSnapshotMs: number[];
};

function summarize(values: number[]) {
  return {
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    avg: Number(
      (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
        2,
      ),
    ),
  };
}

test("measures thread and prompt interaction latency in desktop shell", async () => {
  test.setTimeout(90_000);

  const { app, page, launchContext } = await launchDesktopApp(
    "pi-desktop-e2e-perf-",
  );

  try {
    await waitForAppReady(page);

    const summary = await page.evaluate(async () => {
      const results: BenchmarkSummary = {
        createThreadMs: [],
        switchThreadMs: [],
        sendMessageMs: [],
        shellSnapshotMs: [],
      };

      const sleep = (ms: number) =>
        new Promise<void>((resolve) => window.setTimeout(resolve, ms));

      async function waitFor(
        condition: () => Promise<boolean>,
        timeoutMs: number,
      ) {
        const deadline = performance.now() + timeoutMs;

        while (performance.now() < deadline) {
          if (await condition()) {
            return;
          }

          await sleep(16);
        }

        throw new Error("Timed out waiting for benchmark condition");
      }

      async function getShellSnapshot() {
        const startedAt = performance.now();
        const shell = await window.piDesktop.shell.getSnapshot();
        results.shellSnapshotMs.push(
          Number((performance.now() - startedAt).toFixed(2)),
        );
        return shell;
      }

      async function waitForPromptReady(threadId: string) {
        const probePrompt = `prompt-ready ${threadId}`;

        await waitFor(async () => {
          try {
            await window.piDesktop.agent.prompt(probePrompt);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes("Selected project is still loading")
            ) {
              return false;
            }

            throw error;
          }

          return document.body.innerText.includes(
            `Pi Desktop mock assistant received: ${probePrompt}`,
          );
        }, 15_000);
      }

      const initialShell = await getShellSnapshot();
      const worktreeId = initialShell.catalog.selection.worktreeId;
      if (!worktreeId) {
        throw new Error("Expected active worktree for benchmarks");
      }

      for (let index = 0; index < 3; index += 1) {
        const start = performance.now();
        const threadId = await window.piDesktop.threads.create(worktreeId);

        await waitFor(async () => {
          const shell = await getShellSnapshot();
          return shell.catalog.selection.threadId === threadId;
        }, 15_000);

        results.createThreadMs.push(
          Number((performance.now() - start).toFixed(2)),
        );
      }

      const shellAfterCreate = await getShellSnapshot();
      const openThreadIds =
        shellAfterCreate.catalog.repositories
          .flatMap((repository) => repository.worktrees)
          .find((worktree) => worktree.id === worktreeId)
          ?.threads.filter((thread) => !thread.isArchived)
          .map((thread) => thread.id) ?? [];

      for (const threadId of openThreadIds.slice(0, 3)) {
        const start = performance.now();
        await window.piDesktop.threads.select(threadId);

        await waitFor(async () => {
          const shell = await getShellSnapshot();
          return shell.catalog.selection.threadId === threadId;
        }, 15_000);

        results.switchThreadMs.push(
          Number((performance.now() - start).toFixed(2)),
        );
      }

      for (const threadId of openThreadIds.slice(0, 2)) {
        await window.piDesktop.threads.select(threadId);
        await waitFor(async () => {
          const shell = await getShellSnapshot();
          return shell.catalog.selection.threadId === threadId;
        }, 15_000);
        await waitForPromptReady(threadId);

        const prompt = `perf benchmark ${threadId}`;
        const start = performance.now();
        await window.piDesktop.agent.prompt(prompt);

        await waitFor(async () => {
          return document.body.innerText.includes(
            `Pi Desktop mock assistant received: ${prompt}`,
          );
        }, 15_000);

        results.sendMessageMs.push(
          Number((performance.now() - start).toFixed(2)),
        );
      }

      return results;
    });

    const metrics = {
      createThread: summarize(summary.createThreadMs),
      switchThread: summarize(summary.switchThreadMs),
      sendMessage: summarize(summary.sendMessageMs),
      shellSnapshot: summarize(summary.shellSnapshotMs),
    };

    console.log(`PERF_METRICS ${JSON.stringify({ summary, metrics })}`);

    expect(summary.createThreadMs.length).toBe(3);
    expect(summary.switchThreadMs.length).toBeGreaterThanOrEqual(2);
    expect(summary.sendMessageMs.length).toBe(2);
  } finally {
    await closeDesktopApp(app);
    launchContext.cleanup();
  }
});
