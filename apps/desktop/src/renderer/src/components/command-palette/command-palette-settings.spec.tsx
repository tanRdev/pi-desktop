// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/lib/theme";
import { globalShortcutRegistry } from "@/lib/keyboard";
import { commandHistory } from "./command-history";
import { CommandPaletteHost } from "./command-palette-host";
import { commandRegistry } from "./command-registry";
import { SettingsHost } from "../settings/settings-host";

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

function renderHosts() {
  return render(
    <ThemeProvider>
      <SettingsHost />
      <CommandPaletteHost />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  globalShortcutRegistry.clear();
  commandRegistry.clear();
  commandHistory.clear();
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    createMediaQuery(query, query === "(prefers-color-scheme: dark)"),
  );
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalShortcutRegistry.clear();
  commandRegistry.clear();
  commandHistory.clear();
  vi.restoreAllMocks();
});

describe("Command palette settings integration", () => {
  it("opens settings when the Open Settings row is clicked", async () => {
    renderHosts();

    window.dispatchEvent(new CustomEvent("pi:command-palette:open"));

    const row = await screen.findByTestId("command-row-open-settings");
    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
    });
  });
});
