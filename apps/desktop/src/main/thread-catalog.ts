import { randomUUID } from "node:crypto";
import path from "node:path";
import { PersistentJsonFile } from "./persistent-json-file";

export interface ThreadCatalogEntry {
  id: string;
  worktreeId: string;
  title: string;
  archivedAt: number | null;
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

type CreateThreadInput = {
  worktreeId: string;
  title: string;
};

type LegacyThreadCatalogEntry = Omit<ThreadCatalogEntry, "runtimeId"> & {
  runtimeId?: string | null;
  runtimeSessionName?: string | null;
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
  const archiveWeight =
    Number(left.archivedAt !== null) - Number(right.archivedAt !== null);
  if (archiveWeight !== 0) {
    return archiveWeight;
  }

  const activityWeight =
    (right.lastActivityAt ?? -1) - (left.lastActivityAt ?? -1);
  if (activityWeight !== 0) {
    return activityWeight;
  }

  return right.updatedAt - left.updatedAt;
}

export class ThreadCatalog {
  private readonly store: PersistentJsonFile<ThreadCatalogState>;

  private readonly now: () => number;

  private readonly createId: () => string;

  constructor(userDataPath: string, options: ThreadCatalogOptions = {}) {
    this.store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "threads.json"),
      defaultValue: DEFAULT_STATE,
    });
    this.now = options.now ?? (() => Date.now());
    this.createId = options.createId ?? (() => randomUUID());
  }

  private readThreads(): ThreadCatalogEntry[] {
    const state = this.store.get() as unknown as {
      version: 1;
      threads?: LegacyThreadCatalogEntry[];
    };

    const legacyThreads = state.threads ?? [];
    const threads: ThreadCatalogEntry[] = legacyThreads.map((thread) => ({
      ...thread,
      runtimeId: thread.runtimeId ?? thread.runtimeSessionName ?? null,
    }));

    const hasLegacyRuntimeField = threads.some(
      (thread, index) =>
        legacyThreads[index]?.runtimeId !== thread.runtimeId ||
        "runtimeSessionName" in (legacyThreads[index] ?? {}),
    );

    if (hasLegacyRuntimeField) {
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
      archivedAt: null,
      lastActivityAt: null,
      runtimeId: null,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    this.store.update((state) => ({
      ...state,
      threads: [...state.threads, entry],
    }));

    return entry;
  }

  ensureOpenThread(input: CreateThreadInput): ThreadCatalogEntry {
    const openThread = this.listByWorktree(input.worktreeId).find(
      (thread) => thread.archivedAt === null,
    );

    return openThread ?? this.create(input);
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

  archive(threadId: string): ThreadCatalogEntry | null {
    return this.updateThread(threadId, (thread, currentTime) => ({
      ...thread,
      archivedAt: currentTime,
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

  private updateThread(
    threadId: string,
    updater: (
      thread: ThreadCatalogEntry,
      currentTime: number,
    ) => ThreadCatalogEntry,
  ): ThreadCatalogEntry | null {
    const currentTime = this.now();
    let updatedThread: ThreadCatalogEntry | null = null;

    this.store.update((state) => ({
      ...state,
      threads: state.threads.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        updatedThread = updater(thread, currentTime);
        return updatedThread;
      }),
    }));

    return updatedThread;
  }
}
