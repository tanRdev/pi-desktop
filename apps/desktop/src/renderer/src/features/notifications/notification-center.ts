import { toast as appToast } from "@/lib/toast";
import { isLevelEnabled, isScopeMuted } from "./notification-prefs";
import { playNotificationSound } from "./notification-sound";

export type NotificationLevel = "success" | "info" | "warn" | "error";

export interface NotificationOptions {
  description?: string;
  /** Duration in ms forwarded to the underlying toast. */
  duration?: number;
  /** When true, do not display a sonner toast — only record in history. */
  silent?: boolean;
  /** Categorization scope for muting. */
  scope?: string;
}

export interface Notification {
  id: string;
  level: NotificationLevel;
  message: string;
  description?: string;
  createdAt: number;
}

export type NotificationSubscriber = (
  notifications: ReadonlyArray<Notification>,
) => void;

export interface ToastSurface {
  success: (
    message: string,
    options?: { description?: string; duration?: number },
  ) => void;
  info: (
    message: string,
    options?: { description?: string; duration?: number },
  ) => void;
  warning: (
    message: string,
    options?: { description?: string; duration?: number },
  ) => void;
  error: (
    message: string,
    options?: { description?: string; duration?: number },
  ) => void;
}

export interface NotificationCenterOptions {
  /** Toast surface to forward visual notifications to. Defaults to the app toast (sonner). */
  toast?: ToastSurface;
  /** Maximum number of notifications retained in the in-memory ring buffer. */
  maxHistory?: number;
  /** Override id generator (used in tests). */
  generateId?: () => string;
  /** Override timestamp source (used in tests). */
  now?: () => number;
}

export interface NotificationCenter {
  push: (
    level: NotificationLevel,
    message: string,
    options?: NotificationOptions,
  ) => Notification;
  success: (message: string, options?: NotificationOptions) => Notification;
  info: (message: string, options?: NotificationOptions) => Notification;
  warn: (message: string, options?: NotificationOptions) => Notification;
  error: (message: string, options?: NotificationOptions) => Notification;
  list: () => ReadonlyArray<Notification>;
  clear: () => void;
  subscribe: (subscriber: NotificationSubscriber) => () => void;
}

const DEFAULT_MAX_HISTORY = 50;

let idCounter = 0;
function defaultGenerateId(): string {
  idCounter += 1;
  return `n_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function levelToToastFn(level: NotificationLevel, surface: ToastSurface) {
  if (level === "success") return surface.success;
  if (level === "info") return surface.info;
  if (level === "warn") return surface.warning;
  return surface.error;
}

export function createNotificationCenter(
  options: NotificationCenterOptions = {},
): NotificationCenter {
  const surface = options.toast ?? appToast;
  const maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
  const generateId = options.generateId ?? defaultGenerateId;
  const now = options.now ?? (() => Date.now());

  const items: Notification[] = [];
  const subscribers = new Set<NotificationSubscriber>();

  function snapshot(): ReadonlyArray<Notification> {
    return items.slice();
  }

  function notify(): void {
    const snap = snapshot();
    for (const sub of subscribers) sub(snap);
  }

  function push(
    level: NotificationLevel,
    message: string,
    opts: NotificationOptions = {},
  ): Notification {
    const entry: Notification = {
      id: generateId(),
      level,
      message,
      description: opts.description,
      createdAt: now(),
    };
    items.unshift(entry);
    if (items.length > maxHistory) {
      items.length = maxHistory;
    }

    const levelAllowed = isLevelEnabled(level);
    const scopeMuted = opts.scope !== undefined && isScopeMuted(opts.scope);

    if (opts.silent !== true && levelAllowed && !scopeMuted) {
      const fn = levelToToastFn(level, surface);
      const passthrough: { description?: string; duration?: number } = {};
      if (opts.description !== undefined)
        passthrough.description = opts.description;
      if (opts.duration !== undefined) passthrough.duration = opts.duration;
      fn(message, passthrough);
    }

    if (levelAllowed && !scopeMuted) {
      playNotificationSound(level);
    }

    notify();
    return entry;
  }

  return {
    push,
    success: (message, opts) => push("success", message, opts),
    info: (message, opts) => push("info", message, opts),
    warn: (message, opts) => push("warn", message, opts),
    error: (message, opts) => push("error", message, opts),
    list: () => snapshot(),
    clear: () => {
      if (items.length === 0) return;
      items.length = 0;
      notify();
    },
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      subscriber(snapshot());
      return () => {
        subscribers.delete(subscriber);
      };
    },
  };
}

/** Module-level default center used by hooks and the host. Wraps the app toast (sonner). */
export const globalNotificationCenter: NotificationCenter =
  createNotificationCenter();
