import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AppPreferencesCatalog } from "./app-preferences-catalog";

describe("AppPreferencesCatalog", () => {
  it("preserves favorite models when updating unrelated preferences", () => {
    const userDataPath = mkdtempSync(
      path.join(tmpdir(), "pi-app-preferences-"),
    );
    const catalog = new AppPreferencesCatalog(userDataPath);

    catalog.update({ favoriteModels: ["claude-sonnet-4", "gpt-5.5"] });

    expect(catalog.update({ leftSidebarWidth: 320 })).toEqual({
      leftSidebarWidth: 320,
      favoriteModels: ["claude-sonnet-4", "gpt-5.5"],
    });
  });
});
