import type { NotificationLevel } from "./notification-center";

const STORAGE_KEY = "pi-desktop:notification-prefs";

export interface NotificationPreferences {
  sounds: boolean;
  desktop: boolean;
  levels: NotificationLevel[];
  mutedScopes: string[];
}

const DEFAULT_PREFS: NotificationPreferences = {
  sounds: true,
  desktop: false,
  levels: ["warn", "error"],
  mutedScopes: [],
};

function readFromStorage(): NotificationPreferences {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ...DEFAULT_PREFS };
    }
    const obj = parsed as Record<string, unknown>;
    return {
      sounds:
        typeof obj.sounds === "boolean" ? obj.sounds : DEFAULT_PREFS.sounds,
      desktop:
        typeof obj.desktop === "boolean" ? obj.desktop : DEFAULT_PREFS.desktop,
      levels: Array.isArray(obj.levels)
        ? (obj.levels as NotificationLevel[])
        : DEFAULT_PREFS.levels,
      mutedScopes: Array.isArray(obj.mutedScopes)
        ? (obj.mutedScopes as string[])
        : DEFAULT_PREFS.mutedScopes,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function writeToStorage(prefs: NotificationPreferences): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

export function getNotificationPrefs(): NotificationPreferences {
  return readFromStorage();
}

export function setNotificationPrefs(
  partial: Partial<NotificationPreferences>,
): NotificationPreferences {
  const current = readFromStorage();
  const next: NotificationPreferences = {
    sounds: partial.sounds ?? current.sounds,
    desktop: partial.desktop ?? current.desktop,
    levels: partial.levels ?? current.levels,
    mutedScopes: partial.mutedScopes ?? current.mutedScopes,
  };
  writeToStorage(next);
  return next;
}

export function isLevelEnabled(level: NotificationLevel): boolean {
  const prefs = readFromStorage();
  return prefs.levels.includes(level);
}

export function isScopeMuted(scope: string): boolean {
  const prefs = readFromStorage();
  return prefs.mutedScopes.includes(scope);
}

export function resetNotificationPrefs(): NotificationPreferences {
  writeToStorage({ ...DEFAULT_PREFS });
  return { ...DEFAULT_PREFS };
}
