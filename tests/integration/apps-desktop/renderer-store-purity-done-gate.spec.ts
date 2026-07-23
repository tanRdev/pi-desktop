import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../");

function listTsxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsxFiles(fullPath));
    } else if (
      /\.(tsx|ts)$/.test(entry.name) &&
      !entry.name.includes(".spec.")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Spine 5 renderer store purity done-gate", () => {
  it("useShellModel returns actions from the subscribed snapshot, not ad-hoc getState", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "apps/desktop/src/renderer/src/hooks/use-shell-model.ts"),
      "utf8",
    );
    expect(source).toContain("switchModel: snapshot.switchModel");
    expect(source).toContain(
      "updateAppPreferences: snapshot.updateAppPreferences",
    );
    expect(source).not.toMatch(
      /switchModel:\s*store\.getState\(\)\.switchModel/,
    );
  });

  it("workspace shell sync marks threads via subscribed store actions", () => {
    const source = fs.readFileSync(
      path.join(
        ROOT,
        "apps/desktop/src/renderer/src/features/workspace/use-workspace-shell-sync.ts",
      ),
      "utf8",
    );
    expect(source).toContain("useStore(uiStore, (s) => s.markThreadViewed)");
    expect(source).not.toMatch(/uiStore\.getState\(\)\.markThreadViewed/);
  });

  it("feature hooks under workspace prefer useStore/useSyncExternalStore over render-time getState reads", () => {
    const hooksDir = path.join(
      ROOT,
      "apps/desktop/src/renderer/src/features/workspace",
    );
    const offenders: string[] = [];
    for (const filePath of listTsxFiles(hooksDir)) {
      if (!path.basename(filePath).startsWith("use-")) continue;
      const source = fs.readFileSync(filePath, "utf8");
      // Flag only getState().property reads that look like state (not action calls in callbacks).
      const staleRead =
        /return\s+\{[\s\S]*?\.getState\(\)\.(?!set|create|close|focus|mark|open|clear|update|send|cancel|reload|switch|initialize)/m;
      if (staleRead.test(source) && source.includes("getState().switchModel")) {
        offenders.push(path.relative(ROOT, filePath));
      }
    }
    expect(offenders).toEqual([]);
  });
});
