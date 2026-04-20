import { useState } from "react";
import { type ShortcutRegistry, useKeyboardShortcut } from "@/lib/keyboard";
import { createNavRing } from "./nav-ring";

export type UseNavRingOptions = {
  registry?: ShortcutRegistry;
};

export type UseNavRingReturn = {
  currentRegion: string;
  focusNext: () => void;
  focusPrevious: () => void;
};

export function useNavRing(
  regions: string[],
  options?: UseNavRingOptions,
): UseNavRingReturn {
  const [ring] = useState(() => createNavRing(regions));
  const [currentRegion, setCurrentRegion] = useState(ring.currentRegion);

  function focusNext() {
    const next = ring.focusNext();
    setCurrentRegion(next);
    const el = document.getElementById(next);
    if (el) {
      el.focus();
    }
  }

  function focusPrevious() {
    const prev = ring.focusPrevious();
    setCurrentRegion(prev);
    const el = document.getElementById(prev);
    if (el) {
      el.focus();
    }
  }

  const registryOption = options?.registry
    ? { registry: options.registry }
    : undefined;

  useKeyboardShortcut(
    {
      id: "nav-ring:focus-next",
      keys: "F6",
      description: "Move focus to next region",
      group: "Navigation",
      ...registryOption,
    },
    () => {
      focusNext();
    },
  );

  useKeyboardShortcut(
    {
      id: "nav-ring:focus-previous",
      keys: "Mod+F6",
      description: "Move focus to previous region",
      group: "Navigation",
      ...registryOption,
    },
    () => {
      focusPrevious();
    },
  );

  return { currentRegion, focusNext, focusPrevious };
}
