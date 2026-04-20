// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/lib/theme";
import { SettingsDialog } from "./settings-dialog";
import { DEFAULT_UI_SETTINGS, UI_SETTINGS_STORAGE_KEY } from "./use-settings";

function createMediaQuery(initiallyDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  return {
    matches: initiallyDark,
    addEventListener: vi.fn(
      (type: string, handler: (e: MediaQueryListEvent) => void) => {
        if (type === "change") listeners.add(handler);
      },
    ),
    removeEventListener: vi.fn(),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  const mql = createMediaQuery(true);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    query === "(prefers-color-scheme: dark)"
      ? (mql as unknown as MediaQueryList)
      : ({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as MediaQueryList),
  );
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function renderDialog() {
  return render(
    <ThemeProvider>
      <SettingsDialog open onOpenChange={() => {}} />
    </ThemeProvider>,
  );
}

describe("SettingsDialog", () => {
  it("renders the appearance tab by default", () => {
    renderDialog();

    const panel = screen.getByTestId("settings-panel");
    expect(panel).toHaveAttribute("data-active-section", "appearance");
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
    expect(screen.getByLabelText("Font size")).toBeInTheDocument();
  });

  it("switches sections when a tab is selected", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("settings-tab-terminal"));

    const panel = screen.getByTestId("settings-panel");
    expect(panel).toHaveAttribute("data-active-section", "terminal");
    expect(screen.getByLabelText("Scrollback")).toBeInTheDocument();
    expect(screen.getByLabelText("Cursor style")).toBeInTheDocument();
  });

  it("shows editor controls on the editor tab", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("settings-tab-editor"));

    expect(screen.getByLabelText("Tab size")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Word wrap" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Line numbers" }),
    ).toBeInTheDocument();
  });

  it("persists toggle changes through localStorage", async () => {
    const user = userEvent.setup();
    renderDialog();

    const toggle = screen.getByRole("switch", { name: "Reduce motion" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");
    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    if (raw !== null) {
      expect(JSON.parse(raw).reducedMotion).toBe(true);
    }
  });

  it("persists numeric changes through localStorage", () => {
    renderDialog();

    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "18" } });

    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    if (raw !== null) {
      expect(JSON.parse(raw).fontSize).toBe(18);
    }
  });

  it("exposes the updates and danger zone sections", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId("settings-tab-updates"));
    expect(
      screen.getByRole("switch", { name: "Automatic updates" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Check now/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("settings-tab-danger-zone"));
    expect(
      screen.getByRole("button", { name: /Clear cache/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reset preferences/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reveal in Finder/i }),
    ).toBeInTheDocument();
  });

  it("initial defaults match the shared default snapshot", () => {
    renderDialog();
    const select = screen.getByLabelText("Theme");
    expect(select).toHaveValue(DEFAULT_UI_SETTINGS.theme);
  });
});
