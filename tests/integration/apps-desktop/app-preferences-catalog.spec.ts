import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPreferencesCatalog } from "../../../apps/desktop/src/main/app-preferences-catalog";
import { flushAllPersistentJsonFiles } from "../../../apps/desktop/src/main/persistent-json-file";

const tempDirs: string[] = [];

function createUserDataPath(): string {
  const directory = mkdtempSync(
    path.join(tmpdir(), "pi-desktop-app-preferences-catalog-"),
  );
  tempDirs.push(directory);
  return directory;
}

function catalogFilePath(userDataPath: string): string {
  return path.join(userDataPath, "catalog", "app-preferences.json");
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
      ai: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      },
    });

    const reloaded = new AppPreferencesCatalog(userDataPath);
    expect(reloaded.get()).toEqual({
      leftSidebarWidth: 240,
      ai: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      },
    });
  });

  it("merges partial ai updates into existing preferences", () => {
    const userDataPath = createUserDataPath();
    const catalog = new AppPreferencesCatalog(userDataPath);

    catalog.update({
      leftSidebarWidth: 240,
      ai: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      },
    });

    expect(
      catalog.update({
        ai: {
          provider: "openai",
        },
      }),
    ).toEqual({
      leftSidebarWidth: 240,
      ai: {
        provider: "openai",
        model: "claude-sonnet-4-20250514",
      },
    });
  });

  it("loads a legacy unversioned file and rewrites it with an envelope on next save", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify({ leftSidebarWidth: 160 }), "utf8");

    const catalog = new AppPreferencesCatalog(userDataPath);
    expect(catalog.get()).toEqual({ leftSidebarWidth: 160 });

    catalog.update({ leftSidebarWidth: 400 });
    await flushAllPersistentJsonFiles();

    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      data: { leftSidebarWidth: 400 },
    });
  });

  it("saves new preferences with the envelope shape (schemaVersion present)", async () => {
    const userDataPath = createUserDataPath();
    const catalog = new AppPreferencesCatalog(userDataPath);

    catalog.update({ leftSidebarWidth: 300 });
    await flushAllPersistentJsonFiles();

    const parsed = JSON.parse(
      readFileSync(catalogFilePath(userDataPath), "utf8"),
    );
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.data).toEqual({ leftSidebarWidth: 300 });
  });

  it("recovers to defaults when the persisted file is corrupt and quarantines the bad file", async () => {
    const userDataPath = createUserDataPath();
    const filePath = catalogFilePath(userDataPath);
    const fs = await import("node:fs");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, "{{{not-json", "utf8");

    const warn = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const catalog = new AppPreferencesCatalog(userDataPath);
    expect(catalog.get()).toEqual({});

    warn.mockRestore();

    const siblings = readdirSync(path.dirname(filePath)).filter((entry) =>
      entry.startsWith("app-preferences.json.corrupt-"),
    );
    expect(siblings.length).toBe(1);
  });
});
