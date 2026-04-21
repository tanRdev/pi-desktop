// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBreadcrumb } from "./use-breadcrumb";

describe("useBreadcrumb", () => {
  it("returns empty segments for null filePath", () => {
    const { result } = renderHook(() => useBreadcrumb(null));
    expect(result.current.segments).toEqual([]);
  });

  it("parses a simple single-segment path", () => {
    const { result } = renderHook(() => useBreadcrumb("file.ts"));
    expect(result.current.segments).toEqual([
      { label: "file.ts", path: "file.ts", isLast: true },
    ]);
  });

  it("parses a multi-segment unix path", () => {
    const { result } = renderHook(() =>
      useBreadcrumb("/Users/tan/projects/app/src/index.ts"),
    );
    expect(result.current.segments).toEqual([
      { label: "Users", path: "Users", isLast: false },
      { label: "tan", path: "Users/tan", isLast: false },
      { label: "projects", path: "Users/tan/projects", isLast: false },
      { label: "app", path: "Users/tan/projects/app", isLast: false },
      { label: "src", path: "Users/tan/projects/app/src", isLast: false },
      {
        label: "index.ts",
        path: "Users/tan/projects/app/src/index.ts",
        isLast: true,
      },
    ]);
  });

  it("parses a Windows-style path with backslashes", () => {
    const { result } = renderHook(() =>
      useBreadcrumb("C:\\Users\\dev\\file.txt"),
    );
    expect(result.current.segments).toEqual([
      { label: "C:", path: "C:", isLast: false },
      { label: "Users", path: "C:/Users", isLast: false },
      { label: "dev", path: "C:/Users/dev", isLast: false },
      { label: "file.txt", path: "C:/Users/dev/file.txt", isLast: true },
    ]);
  });

  it("handles paths with consecutive slashes", () => {
    const { result } = renderHook(() => useBreadcrumb("/a//b///c"));
    expect(result.current.segments).toEqual([
      { label: "a", path: "a", isLast: false },
      { label: "b", path: "a/b", isLast: false },
      { label: "c", path: "a/b/c", isLast: true },
    ]);
  });

  it("marks only the last segment as isLast", () => {
    const { result } = renderHook(() =>
      useBreadcrumb("/src/components/App.tsx"),
    );
    const lastSegments = result.current.segments.filter((s) => s.isLast);
    expect(lastSegments).toHaveLength(1);
    const last = lastSegments[0];
    if (!last) throw new Error("No last segment");
    expect(last.label).toBe("App.tsx");
  });

  it("navigateTo calls onNavigate with the given path", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useBreadcrumb("/a/b/c", onNavigate));
    result.current.navigateTo("/a/b");
    expect(onNavigate).toHaveBeenCalledWith("/a/b");
  });

  it("navigateTo does nothing when onNavigate is not provided", () => {
    const { result } = renderHook(() => useBreadcrumb("/a/b/c"));
    expect(() => result.current.navigateTo("/a")).not.toThrow();
  });

  it("accumulates paths correctly without leading slash", () => {
    const { result } = renderHook(() => useBreadcrumb("src/lib/utils.ts"));
    const seg0 = result.current.segments[0];
    const seg1 = result.current.segments[1];
    const seg2 = result.current.segments[2];
    if (!seg0 || !seg1 || !seg2) throw new Error("Missing segments");
    expect(seg0.path).toBe("src");
    expect(seg1.path).toBe("src/lib");
    expect(seg2.path).toBe("src/lib/utils.ts");
  });
});
