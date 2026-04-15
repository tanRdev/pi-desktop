import { describe, expect, it } from "vitest";
import {
  createThreadTitle,
  DEFAULT_UNTITLED_THREAD_TITLE,
  FALLBACK_THREAD_TITLES,
  generateThreadTitleFromMessage,
  getDefaultThreadTitle,
} from "../../../apps/desktop/src/thread-title-defaults";

describe("thread title defaults", () => {
  it("uses default title 'Pi' for new threads", () => {
    expect(DEFAULT_UNTITLED_THREAD_TITLE).toBe("Pi");
    expect(FALLBACK_THREAD_TITLES.length).toBeGreaterThan(64);
    expect(new Set(FALLBACK_THREAD_TITLES).size).toBe(
      FALLBACK_THREAD_TITLES.length,
    );

    for (const title of FALLBACK_THREAD_TITLES) {
      expect(title).toMatch(/^[A-Z][a-z]+$/);
      expect(title.toLowerCase()).not.toContain("thread");
      expect(title).not.toMatch(/\s/);
    }

    expect(getDefaultThreadTitle()).toBe("Pi");
    expect(createThreadTitle(() => 0)).toBe(FALLBACK_THREAD_TITLES[0]);
    expect(createThreadTitle(() => 0.999999)).toBe(
      FALLBACK_THREAD_TITLES[FALLBACK_THREAD_TITLES.length - 1],
    );
  });

  it("skips already-used names when generating titles", () => {
    const usedTitles = new Set([
      FALLBACK_THREAD_TITLES[0],
      FALLBACK_THREAD_TITLES[1],
    ]);

    expect(createThreadTitle(() => 0, usedTitles)).toBe(
      FALLBACK_THREAD_TITLES[2],
    );
  });

  describe("generateThreadTitleFromMessage", () => {
    it("generates title from message text", () => {
      expect(generateThreadTitleFromMessage("Hello world")).toBe("Hello world");
      expect(generateThreadTitleFromMessage("Fix the login bug")).toBe(
        "Fix the login bug",
      );
    });

    it("limits title to first 5 words", () => {
      expect(
        generateThreadTitleFromMessage(
          "This is a very long message with many words",
        ),
      ).toBe("This is a very long");
    });

    it("truncates long titles with ellipsis", () => {
      const longMessage = "This is an extremelylengthy messagetext exceeds";
      expect(generateThreadTitleFromMessage(longMessage)).toBe(
        "This is an extremelylengthy...",
      );
    });

    it("returns default title for empty message", () => {
      expect(generateThreadTitleFromMessage("")).toBe("Pi");
      expect(generateThreadTitleFromMessage("   ")).toBe("Pi");
    });

    it("capitalizes first letter", () => {
      expect(generateThreadTitleFromMessage("hello world")).toBe("Hello world");
    });

    it("handles single word messages", () => {
      expect(generateThreadTitleFromMessage("Refactor")).toBe("Refactor");
    });
  });
});
