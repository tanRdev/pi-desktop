import { describe, expect, it } from "vitest";
import { DEFAULT_AI_PREFERENCES } from "../../../apps/desktop/src/renderer/src/lib/app-preferences";
import {
  getEffectiveLeftSidebarWidth,
  mergeAiPreferenceUpdates,
  normalizeAppPreferences,
  normalizeAppPreferenceUpdates,
} from "../../../apps/desktop/src/renderer/src/stores/app-shell-store-preferences";

describe("app-shell-store preferences helpers", () => {
  it("normalizes updates while preserving the current AI selection", () => {
    const currentPreferences = normalizeAppPreferences({
      leftSidebarWidth: 260,
      ai: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      },
    });

    expect(
      normalizeAppPreferenceUpdates(
        { leftSidebarWidth: 320 },
        currentPreferences,
      ),
    ).toEqual({
      leftSidebarWidth: 320,
      ai: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      },
    });
  });

  it("merges AI preference updates without dropping existing non-empty values", () => {
    expect(
      mergeAiPreferenceUpdates(
        {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
        {
          provider: "",
          model: "claude-opus-4-20250514",
        },
      ),
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-20250514",
    });

    expect(mergeAiPreferenceUpdates(undefined, null)).toEqual(
      DEFAULT_AI_PREFERENCES,
    );
  });

  it("derives the effective sidebar width from normalized preferences", () => {
    expect(getEffectiveLeftSidebarWidth({})).toBe(280);
    expect(getEffectiveLeftSidebarWidth({ leftSidebarWidth: 401 })).toBe(400);
  });
});
