const STORAGE_KEY = "pi-desktop:command-history";
const MAX_ENTRIES = 100;

type InvocationEntry = {
  readonly id: string;
  readonly timestamp: number;
  readonly count: number;
  readonly seq: number;
};

export class CommandHistory {
  private entries = new Map<string, InvocationEntry>();
  private nextSeq = 0;

  constructor() {
    this.load();
  }

  recordInvocation(commandId: string): void {
    const existing = this.entries.get(commandId);
    if (existing) {
      this.entries.set(commandId, {
        id: commandId,
        timestamp: Date.now(),
        count: existing.count + 1,
        seq: this.nextSeq++,
      });
    } else {
      if (this.entries.size >= MAX_ENTRIES) {
        this.evictOldest();
      }
      this.entries.set(commandId, {
        id: commandId,
        timestamp: Date.now(),
        count: 1,
        seq: this.nextSeq++,
      });
    }
    this.save();
  }

  getRecent(limit = 5): string[] {
    const sorted = Array.from(this.entries.values()).sort(
      (a, b) => b.timestamp - a.timestamp || b.seq - a.seq,
    );
    return sorted.slice(0, limit).map((e) => e.id);
  }

  getFrequent(limit = 5): string[] {
    const sorted = Array.from(this.entries.values()).sort(
      (a, b) => b.count - a.count || b.seq - a.seq,
    );
    return sorted.slice(0, limit).map((e) => e.id);
  }

  clear(): void {
    this.entries.clear();
    this.save();
  }

  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestSeq = Infinity;
    for (const entry of this.entries.values()) {
      if (entry.seq < oldestSeq) {
        oldestSeq = entry.seq;
        oldestId = entry.id;
      }
    }
    if (oldestId !== null) {
      this.entries.delete(oldestId);
    }
  }

  private load(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.entries.clear();
        return;
      }
      this.entries.clear();
      let maxSeq = 0;
      for (const item of parsed) {
        if (isInvocationEntry(item)) {
          const seq = item.seq ?? 0;
          this.entries.set(item.id, {
            id: item.id,
            timestamp: item.timestamp,
            count: item.count,
            seq,
          });
          if (seq >= maxSeq) maxSeq = seq + 1;
        }
      }
      this.nextSeq = maxSeq;
    } catch {
      this.entries.clear();
    }
  }

  private save(): void {
    if (typeof window === "undefined") return;
    try {
      const data = Array.from(this.entries.values());
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }
}

export const commandHistory = new CommandHistory();

function isInvocationEntry(value: unknown): value is InvocationEntry {
  if (typeof value !== "object" || value === null) return false;
  if (!Object.hasOwn(value, "id")) return false;
  if (!Object.hasOwn(value, "timestamp")) return false;
  if (!Object.hasOwn(value, "count")) return false;
  const id = Object.getOwnPropertyDescriptor(value, "id")?.value;
  const timestamp = Object.getOwnPropertyDescriptor(value, "timestamp")?.value;
  const count = Object.getOwnPropertyDescriptor(value, "count")?.value;
  return (
    typeof id === "string" &&
    typeof timestamp === "number" &&
    typeof count === "number"
  );
}
