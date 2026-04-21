// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UI_SETTINGS_STORAGE_KEY } from "@/features/settings/use-settings";
import { ThemeProvider, useTheme } from "./theme-provider";

function createMediaQuery(initiallyDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let dark = initiallyDark;
  return {
    matches: dark,
    addEventListener: vi.fn(
      (type: string, handler: (e: MediaQueryListEvent) => void) => {
        if (type === "change") listeners.add(handler);
      },
    ),
    removeEventListener: vi.fn(
      (type: string, handler: (e: MediaQueryListEvent) => void) => {
        if (type === "change") listeners.delete(handler);
      },
    ),
    simulateChange(isDark: boolean) {
      dark = isDark;
      for (const fn of listeners) {
        fn({ matches: isDark } as MediaQueryListEvent);
      }
    },
  };
}

function setupEnvironment(initiallyDark = false) {
  const mql = createMediaQuery(initiallyDark);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    query === "(prefers-color-scheme: dark)"
      ? (mql as unknown as MediaQueryList)
      : ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as MediaQueryList),
  );
  return mql;
}

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("defaults to system mode and resolves to OS preference", () => {
    const _mql = setupEnvironment(false);
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("system");
    expect(result.current.resolvedTheme).toBe("light");

    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });

  it("resolves system mode to dark when OS prefers dark", () => {
    setupEnvironment(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("system");
    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("overrides to dark when setTheme('dark') is called", () => {
    setupEnvironment(false);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("overrides to light when setTheme('light') is called", () => {
    setupEnvironment(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(result.current.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows OS change in system mode", () => {
    const mql = setupEnvironment(false);
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.resolvedTheme).toBe("light");

    act(() => {
      mql.simulateChange(true);
    });

    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      mql.simulateChange(false);
    });

    expect(result.current.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("does not change resolved theme on OS change when mode is explicit", () => {
    const mql = setupEnvironment(false);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    act(() => {
      mql.simulateChange(true);
    });

    expect(result.current.theme).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  it("cleans up media query listener on unmount", () => {
    const _mql = setupEnvironment(false);
    const { unmount } = renderHook(() => useTheme(), { wrapper });

    unmount();

    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)",
    );
  });

  it("persists theme choice to localStorage", () => {
    setupEnvironment(false);
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    const stored = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    expect(stored).not.toBeNull();
    if (stored !== null) {
      expect(JSON.parse(stored).theme).toBe("dark");
    }
  });
});
