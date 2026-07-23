import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  DocumentCatalog,
  type VersionedEnvelope,
  wrapEnvelope,
} from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";
import { recoverCorruptFile } from "./recover-corrupt-file";
import {
  createVersionedDocumentStore,
  validateVersionedDocument,
} from "./versioned-document-store";

const CURRENT_VERSION = 1;
const CATALOG_NAME = "thread-catalog";

export interface ThreadCatalogEntry {
  id: string;
  worktreeId: string;
  title: string;
  lastActivityAt: number | null;
  runtimeId: string | null;
  createdAt: number;
  updatedAt: number;
}

type ThreadCatalogDocumentData = {
  threads: ThreadCatalogEntry[];
};

type ThreadCatalogEnvelope = VersionedEnvelope<ThreadCatalogDocumentData>;

const DEFAULT_DATA: ThreadCatalogDocumentData = {
  threads: [],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
): ThreadCatalogEntry | null {
  if (
    typeof thread.id !== "string" ||
    typeof thread.worktreeId !== "string" ||
    typeof thread.title !== "string" ||
    typeof thread.createdAt !== "number" ||
    typeof thread.updatedAt !== "number"
  ) {
    return null;
  }

  const lastActivityAt = thread.lastActivityAt;
  if (
    lastActivityAt !== null &&
    (typeof lastActivityAt !== "number" || !Number.isFinite(lastActivityAt))
  ) {
    return null;
  }

  return {
    id: thread.id,
    worktreeId: normalizePathId(thread.worktreeId),
    title: thread.title,
    lastActivityAt,
    runtimeId: thread.runtimeId ?? thread.runtimeSessionName ?? null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function decodeThreadCatalogDocumentData(
  raw: unknown,
): ThreadCatalogDocumentData | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.threads)) return null;

  const threads = raw.threads.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const normalized = normalizeThreadEntry(entry as LegacyThreadCatalogEntry);
    return normalized ? [normalized] : [];
  });

  return { threads };
}

export class ThreadCatalog {
  private readonly catalog: DocumentCatalog<
    ThreadCatalogEnvelope,
    ThreadCatalogEntry[],
    ThreadCatalogMutation
  >;

  private readonly now: () => number;

  private readonly createId: () => string;

  constructor(userDataPath: string, options: ThreadCatalogOptions = {}) {
    const filePath = path.join(userDataPath, "catalog", "threads.json");

    recoverCorruptFile(filePath, CATALOG_NAME, {
      currentVersion: CURRENT_VERSION,
      decode: decodeThreadCatalogDocumentData,
    });

    const file = new PersistentJsonFile<unknown>({
      filePath,
      defaultValue: wrapEnvelope(DEFAULT_DATA, CURRENT_VERSION),
      validate: (raw): raw is unknown =>
        validateVersionedDocument(raw, decodeThreadCatalogDocumentData),
    });

    const store = createVersionedDocumentStore(file, {
      currentVersion: CURRENT_VERSION,
      defaultData: DEFAULT_DATA,
      decode: decodeThreadCatalogDocumentData,
    });

    this.catalog = new DocumentCatalog({
      store,
      select: (document) => document.data.threads,
      applyUpdate: (document, mutate) => ({
        schemaVersion: CURRENT_VERSION,
        data: {
          threads: mutate(document.data.threads),
        },
      }),
    });
    this.now = options.now ?? (() => Date.now());
    this.createId = options.createId ?? (() => randomUUID());

    this.catalog.update((threads) => threads);
  }

  listByWorktree(worktreeId: string): ThreadCatalogEntry[] {
    const normalizedWorktreeId = normalizePathId(worktreeId);
    return this.catalog
      .get()
      .filter((thread) => thread.worktreeId === normalizedWorktreeId)
      .sort(sortThreads);
  }

  get(threadId: string): ThreadCatalogEntry | null {
    return this.catalog.get().find((thread) => thread.id === threadId) ?? null;
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
    return this.catalog.get().sort(sortThreads);
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
