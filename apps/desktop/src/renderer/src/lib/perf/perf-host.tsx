import { useCallback, useEffect, useState } from "react";
import { useKeyboardShortcut } from "@/lib/keyboard";
import { PerfOverlay } from "./perf-overlay";
import { globalPerfStore, type PerfStore } from "./perf-store";

export interface PerfHostProps {
  store?: PerfStore;
  /**
   * Override environment detection. When `false`, the host is fully inert
   * unless the localStorage flag is set. Defaults to `import.meta.env.DEV`
   * via {@link isDevEnvironment}.
   */
  enabledInEnvironment?: boolean;
}

const STORAGE_FLAG = "pi:perf-overlay";

function isDevEnvironment(): boolean {
  const meta: unknown = (import.meta as { env?: unknown }).env;
  if (meta === null || typeof meta !== "object") return false;
  if (!("DEV" in meta)) return false;
  const dev = (meta as { DEV: unknown }).DEV;
  return dev === true;
}

function readStorageFlag(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(STORAGE_FLAG) === "1";
  } catch {
    return false;
  }
}

function writeStorageFlag(value: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (value) localStorage.setItem(STORAGE_FLAG, "1");
    else localStorage.removeItem(STORAGE_FLAG);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

/**
 * Mounts the perf overlay. Off by default in production. Activated either by:
 *  - localStorage flag `pi:perf-overlay = "1"` (persistent), or
 *  - the Mod+Alt+P shortcut for the current session (also flips the flag in dev)
 */
export function PerfHost({
  store = globalPerfStore,
  enabledInEnvironment,
}: PerfHostProps = {}): React.ReactElement | null {
  const isDev = enabledInEnvironment ?? isDevEnvironment();
  const [flagEnabled, setFlagEnabled] = useState<boolean>(() =>
    readStorageFlag(),
  );
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_FLAG) return;
      setFlagEnabled(readStorageFlag());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const allowMount = isDev || flagEnabled;

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    // Persist the flag whenever the user toggles the overlay so production
    // sessions remain enabled across reloads after a manual opt-in.
    writeStorageFlag(next);
    setFlagEnabled(next);
  }, []);

  useKeyboardShortcut(
    {
      id: "perf.overlay.toggle",
      keys: "Mod+Alt+P",
      description: "Toggle performance overlay",
      group: "Debug",
      when: () => allowMount,
    },
    () => {
      handleOpenChange(!open);
    },
  );

  if (!allowMount) return null;

  return (
    <PerfOverlay open={open} onOpenChange={handleOpenChange} store={store} />
  );
}
