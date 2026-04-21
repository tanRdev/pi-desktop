import { useEffect, useRef } from "react";

/**
 * Stores the element that had focus when the hook mounts, and restores focus
 * to that element when the hook unmounts.
 *
 * Useful for dialogs, popovers, sheets — anything that takes focus away from
 * the rest of the UI and should hand it back when dismissed.
 *
 * @param enabled when false, the hook does nothing (handy for conditionally
 *   rendered hosts that always call hooks at the top of the component).
 */
export function useFocusRestoration(enabled: boolean = true): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    const active = document.activeElement;
    previouslyFocused.current = active instanceof HTMLElement ? active : null;

    return () => {
      const target = previouslyFocused.current;
      if (!target) return;
      // Only restore if the element is still in the document and focusable.
      if (!document.contains(target)) return;
      try {
        target.focus({ preventScroll: true });
      } catch {
        // ignore — element may have become non-focusable.
      }
    };
  }, [enabled]);
}
