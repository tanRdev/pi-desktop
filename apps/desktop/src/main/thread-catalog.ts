import { randomUUID } from "node:crypto";
import path from "node:path";
import { DocumentCatalog } from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";

export interface ThreadCatalogEntry {
  id: string;
  worktreeId: string;
  title: string;
  lastActivityAt: number | null;
  runtimeId: string | null;
  createdAt: number;
  updatedAt: number;
}

type ThreadCatalogState = {
  version: 1;
  threads: ThreadCatalogEntry[];
};

type ThreadCatalogOptions = {
  now?: () => number;
  createId?: () => string;
};

type ThreadCatalogMutation = (
  threads: ThreadCatalogEntry[],
) => ThreadCatalogEntry[];

type CreateThreadInput = {
  worktreeId: string;
  title: string;
};

type LegacyThreadCatalogEntry = Omit<ThreadCatalogEntry, "runtimeId"> & {
  runtimeId?: string | null;
  runtimeSessionName?: string | null;
};

type LegacyThreadCatalogState = {
  version: 1;
  threads?: LegacyThreadCatalogEntry[];
};

const DEFAULT_STATE: ThreadCatalogState = {
  version: 1,
  threads: [],
};

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

function sortThreads(
  left: ThreadCatalogEntry,
  right: ThreadCatalogEntry,
): number {
  const activityWeight =
    (right.lastActivityAt ?? -1) - (left.lastActivityAt ?? -1);
  if (activityWeight !== 0) {
    return activityWeight;
  }

  return right.updatedAt - left.updatedAt;
}

function normalizeThreadEntry(
  thread: LegacyThreadCatalogEntry,
): ThreadCatalogEntry {
  return {
    id: thread.id,
    worktreeId: thread.worktreeId,
    title: thread.title,
    lastActivityAt: thread.lastActivityAt,
    runtimeId: thread.runtimeId ?? thread.runtimeSessionName ?? null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function readThreadEntries(
  document: ThreadCatalogState | LegacyThreadCatalogState,
): ThreadCatalogEntry[] {
  return (document.threads ?? []).map(normalizeThreadEntry);
}

function needsThreadRuntimeMigration(
  legacyThreads: readonly LegacyThreadCatalogEntry[],
  threads: readonly ThreadCatalogEntry[],
): boolean {
  return threads.some(
    (thread, index) =>
      legacyThreads[index]?.runtimeId !== thread.runtimeId ||
      legacyThreads[index]?.runtimeSessionName !== undefined,
  );
}

export class ThreadCatalog {
  private readonly store: PersistentJsonFile<
    ThreadCatalogState | LegacyThreadCatalogState
  >;

  private readonly catalog: DocumentCatalog<
    ThreadCatalogState | LegacyThreadCatalogState,
    ThreadCatalogEntry[],
    ThreadCatalogMutation
  >;

  private readonly now: () => number;

  private readonly createId: () => string;

  constructor(userDataPath: string, options: ThreadCatalogOptions = {}) {
    this.store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "threads.json"),
      defaultValue: DEFAULT_STATE,
    });

    this.catalog = new DocumentCatalog({
      store: this.store,
      select: readThreadEntries,
      applyUpdate: (document, mutate) => ({
        version: 1,
        threads: mutate(readThreadEntries(document)),
      }),
    });
    this.now = options.now ?? (() => Date.now());
    this.createId = options.createId ?? (() => randomUUID());
  }

  private readThreads(): ThreadCatalogEntry[] {
    const document = this.store.get();
    const legacyThreads = document.threads ?? [];
    const threads = this.catalog.get();

    if (needsThreadRuntimeMigration(legacyThreads, threads)) {
      this.store.set({
        version: 1,
        threads,
      });
    }

    return threads;
  }

  listByWorktree(worktreeId: string): ThreadCatalogEntry[] {
    const normalizedWorktreeId = normalizePathId(worktreeId);
    return this.readThreads()
      .filter((thread) => thread.worktreeId === normalizedWorktreeId)
      .sort(sortThreads);
  }

  get(threadId: string): ThreadCatalogEntry | null {
    return this.readThreads().find((thread) => thread.id === threadId) ?? null;
  }

  create(input: CreateThreadInput): ThreadCatalogEntry {
    const worktreeId = normalizePathId(input.worktreeId);
    const currentTime = this.now();
    const entry: ThreadCatalogEntry = {
      id: this.createId(),
      worktreeId,
      title: input.title,
      lastActivityAt: null,
      runtimeId: null,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    this.catalog.update((threads) => [...threads, entry]);

    return entry;
  }

  ensureOpenThread(input: CreateThreadInput): ThreadCatalogEntry {
    const openThread = this.listByWorktree(input.worktreeId).find(
      (thread) => thread.id !== undefined,
    );

    return openThread ?? this.create(input);
  }

  listAll(): ThreadCatalogEntry[] {
    return this.readThreads().sort(sortThreads);
  }

  touch(
    threadId: string,
    lastActivityAt: number | null,
  ): ThreadCatalogEntry | null {
    return this.updateThread(threadId, (thread, currentTime) => ({
      ...thread,
      lastActivityAt,
      updatedAt: currentTime,
    }));
  }

  rename(threadId: string, title: string): ThreadCatalogEntry | null {
    return this.updateThread(threadId, (thread, currentTime) => ({
      ...thread,
      title,
      updatedAt: currentTime,
    }));
  }

  updateRuntimeSession(
    threadId: string,
    runtimeId: string | null,
  ): ThreadCatalogEntry | null {
    return this.updateThread(threadId, (thread, currentTime) => ({
      ...thread,
      runtimeId,
      updatedAt: currentTime,
    }));
  }

  delete(threadId: string): boolean {
    let deleted = false;
    this.catalog.update((currentThreads) => {
      const threads = currentThreads.filter((thread) => thread.id !== threadId);
      const initialLength = currentThreads.length;
      if (threads.length !== initialLength) {
        deleted = true;
      }
      return threads;
    });
    return deleted;
  }

  private updateThread(
    threadId: string,
    updater: (
      thread: ThreadCatalogEntry,
      currentTime: number,
    ) => ThreadCatalogEntry,
  ): ThreadCatalogEntry | null {
    const currentTime = this.now();
    let updatedThread: ThreadCatalogEntry | null = null;

    this.catalog.update((threads) =>
      threads.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        updatedThread = updater(thread, currentTime);
        return updatedThread;
      }),
    );

    return updatedThread;
  }
}
