// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, RootErrorBoundary, withErrorBoundary } from "./index";

afterEach(() => {
  cleanup();
});

type BombProps = {
  readonly shouldThrow: boolean;
  readonly message?: string;
};

function Bomb({
  shouldThrow,
  message = "kaboom in /Users/tan/secret/file.ts",
}: BombProps) {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid="bomb-ok">ok</div>;
}

describe("ErrorBoundary", () => {
  // React logs caught errors to console.error; suppress noise in tests.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("bomb-ok")).toBeInTheDocument();
    expect(
      screen.queryByTestId("error-boundary-fallback"),
    ).not.toBeInTheDocument();
  });

  it("renders fallback UI with redacted message when child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
    const messageNode = screen.getByTestId("error-boundary-message");
    // Path should be scrubbed to <path>.
    expect(messageNode.textContent).toContain("<path>");
    expect(messageNode.textContent).not.toContain("/Users/tan");
  });

  it("toggles the stack trace on click", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(
      screen.queryByTestId("error-boundary-stack"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("error-boundary-toggle-stack"));
    expect(screen.getByTestId("error-boundary-stack")).toBeInTheDocument();
  });

  it("resets boundary state and re-renders children on Try again", () => {
    function Harness() {
      // Use a mutable ref so we can flip the throw flag from outside React.
      const ref = { current: true };
      const Child = () => <Bomb shouldThrow={ref.current} />;
      return (
        <ErrorBoundary>
          <Child />
        </ErrorBoundary>
      );
    }

    // Simpler: render with a controlled prop.
    let shouldThrow = true;
    function Controlled() {
      return <Bomb shouldThrow={shouldThrow} />;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Controlled />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();

    // Flip the source of the error and click reset.
    shouldThrow = false;
    fireEvent.click(screen.getByTestId("error-boundary-reset"));
    rerender(
      <ErrorBoundary>
        <Controlled />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("bomb-ok")).toBeInTheDocument();
    expect(
      screen.queryByTestId("error-boundary-fallback"),
    ).not.toBeInTheDocument();

    // Silence unused-variable for the unused Harness helper.
    void Harness;
  });

  it("invokes onError callback with the original error", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow={true} message="boom" />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const firstCall = onError.mock.calls[0];
    expect(firstCall?.[0]).toBeInstanceOf(Error);
    expect((firstCall?.[0] as Error).message).toBe("boom");
  });

  it("uses custom fallback when provided", () => {
    render(
      <ErrorBoundary
        fallback={({ redactedMessage, reset }) => (
          <div>
            <span data-testid="custom-fallback">{redactedMessage}</span>
            <button type="button" data-testid="custom-reset" onClick={reset}>
              reset
            </button>
          </div>
        )}
      >
        <Bomb shouldThrow={true} message="oops" />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("custom-fallback")).toHaveTextContent("oops");
  });
});

describe("RootErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders fallback titled with the app name when child throws", () => {
    render(
      <RootErrorBoundary>
        <Bomb shouldThrow={true} message="root boom" />
      </RootErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
    expect(screen.getByText(/Pi Desktop crashed/)).toBeInTheDocument();
  });
});

describe("withErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("wraps a component and catches errors", () => {
    const Guarded = withErrorBoundary(Bomb, { name: "Guarded" });
    render(<Guarded shouldThrow={true} message="hoc boom" />);
    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
    expect(screen.getByText(/Guarded crashed/)).toBeInTheDocument();
  });

  it("preserves displayName for debugging", () => {
    const Guarded = withErrorBoundary(Bomb);
    expect(Guarded.displayName).toBe("withErrorBoundary(Bomb)");
  });
});
