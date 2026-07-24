import { afterEach, describe, expect, it } from "vitest";
import {
  catalogLabelFor,
  drainCatalogQuarantineNotices,
  recordCatalogQuarantine,
  resetCatalogQuarantineNoticesForTests,
} from "./quarantine-notices";

describe("quarantine-notices", () => {
  afterEach(() => {
    resetCatalogQuarantineNoticesForTests();
  });

  it("maps catalog names to glossary-friendly labels", () => {
    expect(catalogLabelFor("app-preferences-catalog")).toBe("App preferences");
    expect(catalogLabelFor("workspace-session-catalog")).toBe(
      "Workspace session",
    );
    expect(catalogLabelFor("thread-catalog")).toBe("Threads");
    expect(catalogLabelFor("unknown-catalog")).toBe("Catalog");
  });

  it("drains recorded notices once without paths or secrets", () => {
    recordCatalogQuarantine("app-preferences-catalog");
    recordCatalogQuarantine("selection-state");

    const first = drainCatalogQuarantineNotices();
    expect(first).toEqual([
      { catalogLabel: "App preferences" },
      { catalogLabel: "Selection" },
    ]);
    expect(JSON.stringify(first)).not.toMatch(/\.json|\/|corrupt-/);

    expect(drainCatalogQuarantineNotices()).toEqual([]);
  });
});
