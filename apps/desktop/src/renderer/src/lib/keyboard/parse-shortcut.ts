export type ParsedShortcut = {
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  /** Normalized key — single characters are lowercase; named keys keep canonical case ("ArrowUp", "Enter", "Escape", " " is "Space"). */
  key: string;
};

export type Platform = "mac" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const platform = navigator.platform ?? "";
  return /Mac|iPhone|iPad/.test(platform) ? "mac" : "other";
}

const MODIFIER_ALIASES: Record<
  string,
  "meta" | "ctrl" | "shift" | "alt" | "mod"
> = {
  mod: "mod",
  cmd: "meta",
  command: "meta",
  meta: "meta",
  super: "meta",
  win: "meta",
  ctrl: "ctrl",
  control: "ctrl",
  shift: "shift",
  alt: "alt",
  option: "alt",
  opt: "alt",
};

const NAMED_KEYS: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  space: " ",
  spacebar: " ",
  backspace: "Backspace",
  delete: "Delete",
  del: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  plus: "+",
  minus: "-",
  slash: "/",
  backslash: "\\",
  comma: ",",
  period: ".",
  dot: ".",
  semicolon: ";",
  quote: "'",
  backtick: "`",
  tilde: "~",
  question: "?",
  bang: "!",
};

function normalizeKeyToken(token: string): string {
  const lower = token.toLowerCase();
  const named = NAMED_KEYS[lower];
  if (named !== undefined) return named;
  // Function keys F1-F24
  const fMatch = /^f([1-9]|1[0-9]|2[0-4])$/.exec(lower);
  if (fMatch) return `F${fMatch[1]}`;
  // Single character: lowercase for letters/numbers/symbols
  if (token.length === 1) return lower;
  // Multi-char unknown — preserve as provided (case-sensitive key name)
  return token;
}

/**
 * Parse "Mod+Shift+K" → ParsedShortcut. "Mod" maps to Meta on mac, Ctrl elsewhere.
 * Throws on invalid input (empty, missing key, multiple non-modifier keys).
 */
export function parseShortcut(
  input: string,
  platform: Platform = detectPlatform(),
): ParsedShortcut {
  if (typeof input !== "string") {
    throw new Error("parseShortcut: input must be a string");
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("parseShortcut: input is empty");
  }

  // Split by + but support literal + via "Plus"
  const parts = trimmed
    .split("+")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error(`parseShortcut: no tokens in "${input}"`);
  }

  let meta = false;
  let ctrl = false;
  let shift = false;
  let alt = false;
  let key: string | null = null;

  for (const part of parts) {
    const modKind = MODIFIER_ALIASES[part.toLowerCase()];
    if (modKind !== undefined) {
      if (modKind === "mod") {
        if (platform === "mac") meta = true;
        else ctrl = true;
      } else if (modKind === "meta") {
        meta = true;
      } else if (modKind === "ctrl") {
        ctrl = true;
      } else if (modKind === "shift") {
        shift = true;
      } else if (modKind === "alt") {
        alt = true;
      }
      continue;
    }
    if (key !== null) {
      throw new Error(
        `parseShortcut: multiple non-modifier keys in "${input}" (got "${key}" and "${part}")`,
      );
    }
    key = normalizeKeyToken(part);
  }

  if (key === null) {
    throw new Error(`parseShortcut: missing non-modifier key in "${input}"`);
  }

  return { meta, ctrl, shift, alt, key };
}

/** Normalize a KeyboardEvent.key for comparison against ParsedShortcut.key. */
export function normalizeEventKey(eventKey: string): string {
  if (eventKey.length === 1) return eventKey.toLowerCase();
  return eventKey;
}

/** Check if a KeyboardEvent matches a parsed shortcut. */
export function matchesShortcut(
  event: Pick<
    KeyboardEvent,
    "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
  >,
  shortcut: ParsedShortcut,
): boolean {
  if (event.metaKey !== shortcut.meta) return false;
  if (event.ctrlKey !== shortcut.ctrl) return false;
  if (event.shiftKey !== shortcut.shift) return false;
  if (event.altKey !== shortcut.alt) return false;
  return normalizeEventKey(event.key) === shortcut.key;
}

/** Human-readable label: "⌘⇧K" on mac, "Ctrl+Shift+K" elsewhere. */
export function formatShortcut(
  shortcut: ParsedShortcut,
  platform: Platform = detectPlatform(),
): string {
  const parts: string[] = [];
  if (platform === "mac") {
    if (shortcut.ctrl) parts.push("⌃");
    if (shortcut.alt) parts.push("⌥");
    if (shortcut.shift) parts.push("⇧");
    if (shortcut.meta) parts.push("⌘");
    parts.push(formatKeyLabel(shortcut.key));
    return parts.join("");
  }
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.meta) parts.push("Meta");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(formatKeyLabel(shortcut.key));
  return parts.join("+");
}

function formatKeyLabel(key: string): string {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}
