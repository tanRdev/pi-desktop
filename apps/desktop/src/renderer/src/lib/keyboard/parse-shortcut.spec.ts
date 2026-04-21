import { describe, expect, it } from "vitest";
import {
  formatShortcut,
  matchesShortcut,
  normalizeEventKey,
  parseShortcut,
} from "./parse-shortcut";

describe("parseShortcut", () => {
  it("maps Mod to meta on mac", () => {
    const s = parseShortcut("Mod+K", "mac");
    expect(s).toEqual({
      meta: true,
      ctrl: false,
      shift: false,
      alt: false,
      key: "k",
    });
  });

  it("maps Mod to ctrl on other platforms", () => {
    const s = parseShortcut("Mod+K", "other");
    expect(s).toEqual({
      meta: false,
      ctrl: true,
      shift: false,
      alt: false,
      key: "k",
    });
  });

  it("parses combos with Shift and Alt", () => {
    const s = parseShortcut("Mod+Shift+Alt+P", "mac");
    expect(s.meta).toBe(true);
    expect(s.shift).toBe(true);
    expect(s.alt).toBe(true);
    expect(s.key).toBe("p");
  });

  it("accepts modifier aliases (Cmd, Command, Option, Opt, Control)", () => {
    expect(parseShortcut("Cmd+A", "mac").meta).toBe(true);
    expect(parseShortcut("Command+A", "mac").meta).toBe(true);
    expect(parseShortcut("Option+A", "mac").alt).toBe(true);
    expect(parseShortcut("Opt+A", "mac").alt).toBe(true);
    expect(parseShortcut("Control+A", "mac").ctrl).toBe(true);
  });

  it("lowercases letter keys", () => {
    expect(parseShortcut("K", "other").key).toBe("k");
    expect(parseShortcut("k", "other").key).toBe("k");
  });

  it("normalizes named keys", () => {
    expect(parseShortcut("Escape", "other").key).toBe("Escape");
    expect(parseShortcut("Esc", "other").key).toBe("Escape");
    expect(parseShortcut("Enter", "other").key).toBe("Enter");
    expect(parseShortcut("Return", "other").key).toBe("Enter");
    expect(parseShortcut("Space", "other").key).toBe(" ");
    expect(parseShortcut("ArrowUp", "other").key).toBe("ArrowUp");
    expect(parseShortcut("Up", "other").key).toBe("ArrowUp");
  });

  it("normalizes function keys", () => {
    expect(parseShortcut("F1", "other").key).toBe("F1");
    expect(parseShortcut("f12", "other").key).toBe("F12");
  });

  it("is tolerant of extra whitespace", () => {
    const s = parseShortcut("  Mod  +  Shift  +  K ", "mac");
    expect(s).toEqual({
      meta: true,
      ctrl: false,
      shift: true,
      alt: false,
      key: "k",
    });
  });

  it("throws on empty input", () => {
    expect(() => parseShortcut("", "mac")).toThrow();
    expect(() => parseShortcut("   ", "mac")).toThrow();
  });

  it("throws when no non-modifier key is present", () => {
    expect(() => parseShortcut("Mod+Shift", "mac")).toThrow(
      /missing non-modifier/,
    );
  });

  it("throws when multiple non-modifier keys are present", () => {
    expect(() => parseShortcut("K+L", "mac")).toThrow(/multiple non-modifier/);
  });
});

describe("normalizeEventKey", () => {
  it("lowercases single-char keys", () => {
    expect(normalizeEventKey("K")).toBe("k");
  });

  it("preserves named keys", () => {
    expect(normalizeEventKey("ArrowDown")).toBe("ArrowDown");
    expect(normalizeEventKey("Escape")).toBe("Escape");
  });
});

describe("matchesShortcut", () => {
  it("matches when all modifiers and key align", () => {
    const parsed = parseShortcut("Mod+Shift+K", "mac");
    const ev = {
      key: "K",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
    };
    expect(matchesShortcut(ev, parsed)).toBe(true);
  });

  it("fails when a modifier differs", () => {
    const parsed = parseShortcut("Mod+K", "mac");
    const ev = {
      key: "k",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(matchesShortcut(ev, parsed)).toBe(false);
  });

  it("requires no extra modifiers", () => {
    const parsed = parseShortcut("K", "other");
    const ev = {
      key: "k",
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
    };
    expect(matchesShortcut(ev, parsed)).toBe(false);
  });
});

describe("formatShortcut", () => {
  it("uses glyphs on mac", () => {
    const s = parseShortcut("Mod+Shift+K", "mac");
    expect(formatShortcut(s, "mac")).toBe("⇧⌘K");
  });

  it("uses words on other platforms", () => {
    const s = parseShortcut("Mod+Shift+K", "other");
    expect(formatShortcut(s, "other")).toBe("Ctrl+Shift+K");
  });

  it("labels space as Space", () => {
    const s = parseShortcut("Space", "other");
    expect(formatShortcut(s, "other")).toBe("Space");
  });
});
