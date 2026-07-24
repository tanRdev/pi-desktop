import { describe, expect, it } from "vitest";
import { resolveAppIconPath } from "./resolve-app-icon";

describe("resolveAppIconPath", () => {
  it("finds the repo build icon when unpackaged", () => {
    const resolved = resolveAppIconPath(
      false,
      "/tmp/missing-resources",
      // Simulate apps/desktop/out/main/index.js
      new URL(`file://${process.cwd()}/apps/desktop/out/main/index.js`).href,
    );

    expect(resolved).toMatch(/build\/icon\.(icns|png)$/);
  });

  it("prefers packaged resource icons when present", () => {
    // Packaged path first — if resources don't exist, falls through to repo build
    const resolved = resolveAppIconPath(
      true,
      "/tmp/definitely-missing-resources",
      new URL(`file://${process.cwd()}/apps/desktop/out/main/index.js`).href,
    );
    expect(resolved).toMatch(/build\/icon\.(icns|png)$/);
  });
});
