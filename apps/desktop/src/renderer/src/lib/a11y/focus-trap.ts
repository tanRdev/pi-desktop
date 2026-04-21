/**
 * Focus trap utility — given a container element, traps Tab / Shift+Tab
 * cycling among focusable descendants. No external dependencies.
 *
 * Usage:
 *   const release = trapFocus(containerEl);
 *   // ...later
 *   release();
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
  "audio[controls]",
  "video[controls]",
  "details > summary:first-of-type",
].join(",");

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const result: HTMLElement[] = [];
  for (const node of nodes) {
    if (isFocusable(node)) {
      result.push(node);
    }
  }
  // Some implementations of querySelectorAll do not strictly preserve document
  // order across comma-separated selectors. Sort defensively so callers always
  // see DOM order (which determines correct Tab cycle behavior).
  result.sort((a, b) => {
    if (a === b) return 0;
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  return result;
}

function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  // Hidden via CSS or attribute
  if (el.hidden) return false;
  // Skip elements with no layout box (display:none, etc.) when we can detect.
  // jsdom returns 0 for offsetParent reliably for display:none.
  // For visibility:hidden offsetParent may be null; treat null offsetParent
  // as hidden EXCEPT for fixed-position elements (which have null offsetParent
  // but may still be visible). Best-effort heuristic.
  const style =
    typeof window !== "undefined" && window.getComputedStyle
      ? window.getComputedStyle(el)
      : null;
  if (style && (style.display === "none" || style.visibility === "hidden")) {
    return false;
  }
  return true;
}

export interface FocusTrapOptions {
  /** If true, focus the first focusable element when trap is installed. */
  initialFocus?: boolean;
}

/**
 * Install a focus trap on the container. Returns a release function that
 * removes the listener.
 */
export function trapFocus(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      // Nothing focusable — keep focus inside the container itself.
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener("keydown", handleKeyDown);

  if (options.initialFocus) {
    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0]?.focus();
    } else {
      // Make container programmatically focusable for fallback.
      if (!container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      container.focus();
    }
  }

  return () => {
    container.removeEventListener("keydown", handleKeyDown);
  };
}
