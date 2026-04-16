/**
 * A minimal LRU (least-recently-used) map backed by an insertion-ordered Map.
 *
 * Map iteration order reflects insertion order. We treat the oldest key as
 * least recently used. On `get`, we reinsert the entry to mark it as most
 * recently used. On `set`, once capacity is exceeded, the oldest entry is
 * evicted.
 */
export class LruMap<K, V> implements Iterable<[K, V]> {
  private readonly store = new Map<K, V>();

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`LruMap capacity must be a positive integer`);
    }
  }

  get size(): number {
    return this.store.size;
  }

  get(key: K): V | undefined {
    if (!this.store.has(key)) {
      return undefined;
    }
    const value = this.store.get(key);
    if (value === undefined) {
      return undefined;
    }
    // Refresh recency by re-inserting.
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  has(key: K): boolean {
    return this.store.has(key);
  }

  set(key: K, value: V): this {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, value);
    if (this.store.size > this.capacity) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    return this;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.store[Symbol.iterator]();
  }

  entries(): IterableIterator<[K, V]> {
    return this.store.entries();
  }

  keys(): IterableIterator<K> {
    return this.store.keys();
  }

  values(): IterableIterator<V> {
    return this.store.values();
  }
}
