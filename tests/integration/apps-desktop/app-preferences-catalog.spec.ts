import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppPreferencesCatalog } from "../../../apps/desktop/src/main/app-preferences-catalog";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pidesk-app-preferences-catalog-"),
  );
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("AppPreferencesCatalog", () => {
  it("persists app preferences and legacy sidebar imports", () => {
    const userDataPath = createUserDataPath();
    const catalog = new AppPreferencesCatalog(userDataPath);

    catalog.update({
      leftSidebarWidth: 240,
      settings: {
        interface: {
          theme: "dark",
        },
      },
    });

    const reloaded = new AppPreferencesCatalog(userDataPath);
    expect(reloaded.get()).toEqual({
      leftSidebarWidth: 240,
      settings: {
        interface: {
          theme: "dark",
        },
      },
    });
  });
});
