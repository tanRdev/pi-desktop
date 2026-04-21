// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ONBOARDING_KEY, OnboardingGuard } from "./onboarding-guard";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("OnboardingGuard", () => {
  it("renders the welcome dialog when the onboarding flag is absent", async () => {
    render(<OnboardingGuard />);

    await waitFor(() => {
      expect(screen.getByTestId("welcome-dialog")).toBeInTheDocument();
    });
  });

  it("skips the dialog when the onboarding flag is already set", async () => {
    window.localStorage.setItem(ONBOARDING_KEY, "true");

    render(<OnboardingGuard>done</OnboardingGuard>);

    await waitFor(() => {
      expect(screen.queryByTestId("welcome-dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByText("done")).toBeInTheDocument();
  });

  it("marks onboarding complete and hides the dialog after completion", async () => {
    const user = userEvent.setup();
    render(<OnboardingGuard />);

    await waitFor(() => {
      expect(screen.getByTestId("welcome-dialog")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("onboarding-skip"));

    await waitFor(() => {
      expect(window.localStorage.getItem(ONBOARDING_KEY)).toBe("true");
      expect(screen.queryByTestId("welcome-dialog")).not.toBeInTheDocument();
    });
  });

  it("renders nothing while checking localStorage", () => {
    const { container } = render(<OnboardingGuard />);
    expect(container.innerHTML).toBe("");
  });
});
