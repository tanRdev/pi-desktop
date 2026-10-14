import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSearchService } from "../../../apps/desktop/src/main/workspace-search-service";

vi.mock("node:child_process", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    spawn: () => {
      const child = Object.assign(new EventEmitter(), {
        stdout: null,
        stderr: null,
        killed: false,
        kill: vi.fn(),
      });
      queueMicrotask(() =>
        child.emit(
          "error",
          Object.assign(new Error("fff missing"), { code: "ENOENT" }),
        ),
      );
      return child;
    },
  };
});

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("fallback workspace search", () => {
  it("matches the query before limiting results and prunes excluded trees", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-search-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "src"));
    fs.mkdirSync(path.join(root, "build"));
    fs.writeFileSync(path.join(root, "a-unrelated.txt"), "");
    fs.writeFileSync(path.join(root, "src", "Auth.ts"), "");
    fs.writeFileSync(path.join(root, "build", "auth.ts"), "");
    const readdir = vi.spyOn(fs.promises, "readdir");
    const response = await new WorkspaceSearchService().search({
      rootPath: root,
      query: "AUTH.TS",
      maxResults: 1,
      excludePatterns: ["build/**"],
    });
    expect(response.results.map((match) => match.path)).toEqual([
      path.join(root, "src", "Auth.ts"),
    ]);
    expect(readdir.mock.calls.map(([directory]) => directory)).not.toContain(
      path.join(root, "build"),
    );
  });

  it("preserves glob include filters on nested paths", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-search-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src", "auth.ts"), "");
    fs.writeFileSync(path.join(root, "auth.ts"), "");
    fs.writeFileSync(path.join(root, "src", "auth.txt"), "");
    const response = await new WorkspaceSearchService().search({
      rootPath: root,
      query: "auth",
      includePatterns: ["**/*.ts"],
    });
    expect(response.results.map((match) => match.name)).toEqual([
      "auth.ts",
      "auth.ts",
    ]);
  });
});
