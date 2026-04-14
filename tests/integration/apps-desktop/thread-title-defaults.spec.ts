import { describe, expect, it } from "vitest";
import {
  createThreadTitle,
  DEFAULT_UNTITLED_THREAD_TITLE,
  FALLBACK_THREAD_TITLES,
  getDefaultThreadTitle,
} from "../../../apps/desktop/src/thread-title-defaults";

describe("thread title defaults", () => {
  it("uses one-word generated names from a large non-city pool", () => {
    expect(DEFAULT_UNTITLED_THREAD_TITLE).toBe("Signal");
    expect(FALLBACK_THREAD_TITLES.length).toBeGreaterThan(64);
    expect(new Set(FALLBACK_THREAD_TITLES).size).toBe(
      FALLBACK_THREAD_TITLES.length,
    );

    for (const title of FALLBACK_THREAD_TITLES) {
      expect(title).toMatch(/^[A-Z][a-z]+$/);
      expect(title.toLowerCase()).not.toContain("thread");
      expect(title).not.toMatch(/\s/);
    }

    expect(getDefaultThreadTitle()).toBe("Signal");
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
});
