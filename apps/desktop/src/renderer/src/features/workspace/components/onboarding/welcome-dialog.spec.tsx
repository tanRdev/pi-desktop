// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_KEY, WelcomeDialog } from "./welcome-dialog";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockPiDesktop(overrides?: Partial<Window["piDesktop"]>): void {
  Object.defineProperty(window, "piDesktop", {
    value: {
      dialog: {
        showOpenDialog: vi.fn().mockResolvedValue(null),
        openExternal: vi.fn(),
      },
      repositories: {
        add: vi.fn().mockResolvedValue(undefined),
        reorder: vi.fn().mockResolvedValue(undefined),
        select: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        openInFinder: vi.fn().mockResolvedValue(undefined),
      },
      ...overrides,
    },
    writable: true,
    configurable: true,
  });
}

describe("WelcomeDialog", () => {
  it("shows the welcome step on first launch", () => {
    render(<WelcomeDialog open onComplete={() => {}} />);

    expect(screen.getByTestId("welcome-dialog")).toBeInTheDocument();
    expect(
      screen.getAllByText("Welcome to Pi Desktop").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("onboarding-next")).toBeInTheDocument();
  });

  it("advances through steps when Next is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WelcomeDialog open onComplete={onComplete} />);

    expect(
      screen.getByTestId("welcome-dialog").querySelector("[data-step]"),
    ).toHaveAttribute("data-step", "0");

    await user.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();

    await user.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByText("Choose your first workspace")).toBeInTheDocument();

    await user.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByText("You're all set!")).toBeInTheDocument();
  });

  it("shows Back button on steps after the first", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog open onComplete={() => {}} />);

    expect(screen.queryByTestId("onboarding-back")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByTestId("onboarding-back")).toBeInTheDocument();

    await user.click(screen.getByTestId("onboarding-back"));
    expect(screen.queryByTestId("onboarding-back")).not.toBeInTheDocument();
  });

  it("shows Skip button on non-final steps", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WelcomeDialog open onComplete={onComplete} />);

    expect(screen.getByTestId("onboarding-skip")).toBeInTheDocument();

    await user.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByTestId("onboarding-skip")).toBeInTheDocument();

    await user.click(screen.getByTestId("onboarding-next"));
    await user.click(screen.getByTestId("onboarding-next"));
    expect(screen.queryByTestId("onboarding-skip")).not.toBeInTheDocument();
  });

  it("sets localStorage and calls onComplete when Get Started is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WelcomeDialog open onComplete={onComplete} />);

    await user.click(screen.getByTestId("onboarding-next"));
    await user.click(screen.getByTestId("onboarding-next"));
    await user.click(screen.getByTestId("onboarding-next"));

    expect(screen.getByTestId("onboarding-get-started")).toBeInTheDocument();
    await user.click(screen.getByTestId("onboarding-get-started"));

    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("true");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("sets localStorage and calls onComplete when Skip is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WelcomeDialog open onComplete={onComplete} />);

    await user.click(screen.getByTestId("onboarding-skip"));

    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("true");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("marks onboarded on Escape key", async () => {
    const onComplete = vi.fn();
    render(<WelcomeDialog open onComplete={onComplete} />);

    const dialog = screen.getByTestId("welcome-dialog");
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("true");
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("advances on Enter key", async () => {
    const onComplete = vi.fn();
    render(<WelcomeDialog open onComplete={onComplete} />);

    const dialog = screen.getByTestId("welcome-dialog");
    expect(dialog.querySelector("[data-step]")).toHaveAttribute(
      "data-step",
      "0",
    );

    dialog.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    });
  });

  it("renders step dots matching current step", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog open onComplete={() => {}} />);

    expect(screen.getByTestId("step-dot-0")).toHaveClass("bg-white/80");

    await user.click(screen.getByTestId("onboarding-next"));
    expect(screen.getByTestId("step-dot-1")).toHaveClass("bg-white/80");
    expect(screen.getByTestId("step-dot-0")).toHaveClass("bg-white/40");
  });

  it("adds the selected workspace from the open-folder step", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const showOpenDialog = vi.fn().mockResolvedValue(["/tmp/workspaces/alpha"]);
    const addRepository = vi.fn().mockResolvedValue(undefined);

    mockPiDesktop({
      dialog: {
        showOpenDialog,
        openExternal: vi.fn(),
      },
      repositories: {
        add: addRepository,
        reorder: vi.fn().mockResolvedValue(undefined),
        select: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        openInFinder: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<WelcomeDialog open onComplete={onComplete} />);

    await user.click(screen.getByTestId("onboarding-next"));
    await user.click(screen.getByTestId("onboarding-next"));
    await user.click(screen.getByTestId("onboarding-open-folder"));

    await waitFor(() => {
      expect(showOpenDialog).toHaveBeenCalledWith({
        properties: ["openDirectory"],
        title: "Choose your first workspace",
      });
      expect(addRepository).toHaveBeenCalledWith("/tmp/workspaces/alpha");
      expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("true");
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
