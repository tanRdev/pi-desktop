// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type QuickOpenFile, useQuickOpen } from "./use-quick-open";

function file(name: string, path?: string): QuickOpenFile {
  return { name, path: path ?? `/root/${name}` };
}

describe("useQuickOpen", () => {
  it("returns all files (up to limit) when query is empty", () => {
    const files = [file("a.ts"), file("b.ts"), file("c.ts")];
    const { result } = renderHook(() => useQuickOpen(files, ""));
    expect(result.current.matches).toHaveLength(3);
  });

  it("returns [] when nothing matches", () => {
    const files = [file("alpha.ts"), file("beta.ts")];
    const { result } = renderHook(() => useQuickOpen(files, "zzz"));
    expect(result.current.matches).toEqual([]);
  });

  it("ranks name matches higher than path-only matches", () => {
    const nameMatch = file("config.ts", "/root/deeply/nested/config.ts");
    const pathMatch = file("other.ts", "/root/config-dir/other.ts");
    const { result } = renderHook(() =>
      useQuickOpen([pathMatch, nameMatch], "config"),
    );
    expect(result.current.matches[0]?.file.name).toBe("config.ts");
  });

  it("gives prefix matches a higher score than mid-word matches", () => {
    const prefix = file("readme.md");
    const mid = file("xreadmeyz.md");
    const { result } = renderHook(() => useQuickOpen([mid, prefix], "read"));
    expect(result.current.matches[0]?.file.name).toBe("readme.md");
  });

  it("returns match indices for name highlighting", () => {
    const files = [file("apple.ts")];
    const { result } = renderHook(() => useQuickOpen(files, "apl"));
    const m = result.current.matches[0];
    expect(m).toBeDefined();
    expect(m?.nameMatchIndices).toEqual([0, 1, 3]);
  });

  it("respects the `limit` option", () => {
    const files = Array.from({ length: 100 }, (_, i) => file(`file-${i}.ts`));
    const { result } = renderHook(() =>
      useQuickOpen(files, "file", { limit: 5 }),
    );
    expect(result.current.matches).toHaveLength(5);
  });

  it("is case-insensitive", () => {
    const files = [file("HELLO.ts")];
    const { result } = renderHook(() => useQuickOpen(files, "hel"));
    expect(result.current.matches).toHaveLength(1);
  });
});
