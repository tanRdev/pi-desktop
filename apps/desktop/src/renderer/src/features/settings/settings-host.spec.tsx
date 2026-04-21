// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { globalShortcutRegistry } from "@/lib/keyboard";
import { ThemeProvider } from "@/lib/theme";
import { SettingsHost } from "./settings-host";

function createMediaQuery(query: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  };
}

function renderHost() {
  return render(
    <ThemeProvider>
      <SettingsHost />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  globalShortcutRegistry.clear();
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    createMediaQuery(query, query === "(prefers-color-scheme: dark)"),
  );
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalShortcutRegistry.clear();
  vi.restoreAllMocks();
});

describe("SettingsHost", () => {
  it("opens the dialog when a shared open-settings command is dispatched", async () => {
    renderHost();

    expect(screen.queryByTestId("settings-dialog")).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("pi:command", {
          detail: { commandId: "open-settings" },
        }),
      );
    });

    expect(await screen.findByTestId("settings-dialog")).toBeInTheDocument();
  });

  it("opens the dialog when the slash-command settings event is dispatched", async () => {
    renderHost();

    expect(screen.queryByTestId("settings-dialog")).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("pi:command", {
          detail: { commandId: "settings", slash: "/settings" },
        }),
      );
    });

    expect(await screen.findByTestId("settings-dialog")).toBeInTheDocument();
  });

  it("opens the dialog when the command-palette event is dispatched", async () => {
    renderHost();

    expect(screen.queryByTestId("settings-dialog")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent("pi:command:open-settings"));
    });

    expect(await screen.findByTestId("settings-dialog")).toBeInTheDocument();
  });
});
