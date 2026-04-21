import {
  detectPlatform,
  matchesShortcut,
  type ParsedShortcut,
  type Platform,
  parseShortcut,
} from "./parse-shortcut";

export type ShortcutHandler = (event: KeyboardEvent) => void;

export type ShortcutDefinition = {
  id: string;
  keys: string | string[];
  description: string;
  group: string;
  run: ShortcutHandler;
  when?: () => boolean;
  /** Allow shortcut to fire while focus is in an input/textarea/contenteditable. Default false. */
  allowInInput?: boolean;
  /** Prevent default browser behavior on match. Default true. */
  preventDefault?: boolean;
  /** Stop propagation on match. Default true. */
  stopPropagation?: boolean;
};

export type RegisteredShortcut = ShortcutDefinition & {
  parsed: ParsedShortcut[];
  rawKeys: string[];
};

export type ShortcutSubscriber = (
  shortcuts: ReadonlyArray<RegisteredShortcut>,
) => void;

export type Logger = {
  warn: (...args: unknown[]) => void;
};

export type ShortcutRegistryOptions = {
  platform?: Platform;
  logger?: Logger;
};

export type ShortcutRegistry = {
  register: (definition: ShortcutDefinition) => () => void;
  unregister: (id: string) => void;
  list: () => ReadonlyArray<RegisteredShortcut>;
  subscribe: (subscriber: ShortcutSubscriber) => () => void;
  handleEvent: (event: KeyboardEvent) => boolean;
  clear: () => void;
};

function toKeysArray(keys: string | string[]): string[] {
  return Array.isArray(keys) ? keys.slice() : [keys];
}

function shortcutSignature(parsed: ParsedShortcut): string {
  return [
    parsed.meta ? "M" : "",
    parsed.ctrl ? "C" : "",
    parsed.shift ? "S" : "",
    parsed.alt ? "A" : "",
    parsed.key,
  ].join("|");
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (target === null) return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function createShortcutRegistry(
  options: ShortcutRegistryOptions = {},
): ShortcutRegistry {
  const platform = options.platform ?? detectPlatform();
  const logger: Logger = options.logger ?? console;

  const byId = new Map<string, RegisteredShortcut>();
  const subscribers = new Set<ShortcutSubscriber>();

  function notify(): void {
    const snapshot = Array.from(byId.values());
    for (const sub of subscribers) sub(snapshot);
  }

  function detectConflicts(next: RegisteredShortcut): void {
    const nextSigs = new Set(next.parsed.map(shortcutSignature));
    for (const existing of byId.values()) {
      if (existing.id === next.id) continue;
      for (const p of existing.parsed) {
        if (nextSigs.has(shortcutSignature(p))) {
          logger.warn(
            `[shortcut-registry] conflict: "${next.id}" shares key with "${existing.id}"`,
          );
          return;
        }
      }
    }
  }

  function register(definition: ShortcutDefinition): () => void {
    const rawKeys = toKeysArray(definition.keys);
    if (rawKeys.length === 0) {
      throw new Error(
        `[shortcut-registry] "${definition.id}" must declare at least one key combo`,
      );
    }
    const parsed = rawKeys.map((raw) => parseShortcut(raw, platform));
    const entry: RegisteredShortcut = {
      ...definition,
      parsed,
      rawKeys,
    };
    if (byId.has(definition.id)) {
      logger.warn(
        `[shortcut-registry] replacing existing shortcut with id "${definition.id}"`,
      );
    }
    detectConflicts(entry);
    byId.set(definition.id, entry);
    notify();
    return () => unregister(definition.id);
  }

  function unregister(id: string): void {
    if (byId.delete(id)) notify();
  }

  function list(): ReadonlyArray<RegisteredShortcut> {
    return Array.from(byId.values());
  }

  function subscribe(subscriber: ShortcutSubscriber): () => void {
    subscribers.add(subscriber);
    subscriber(Array.from(byId.values()));
    return () => {
      subscribers.delete(subscriber);
    };
  }

  function handleEvent(event: KeyboardEvent): boolean {
    const editable = isEditableTarget(event.target);
    for (const entry of byId.values()) {
      if (editable && entry.allowInInput !== true) continue;
      if (entry.when !== undefined && !entry.when()) continue;
      for (const p of entry.parsed) {
        if (matchesShortcut(event, p)) {
          if (entry.preventDefault !== false) event.preventDefault();
          if (entry.stopPropagation !== false) event.stopPropagation();
          entry.run(event);
          return true;
        }
      }
    }
    return false;
  }

  function clear(): void {
    byId.clear();
    notify();
  }

  return { register, unregister, list, subscribe, handleEvent, clear };
}

/** Module-level default registry used by hooks and KeyboardHost. */
export const globalShortcutRegistry: ShortcutRegistry =
  createShortcutRegistry();
