import {
  ArrowClockwise,
  CaretDown,
  CaretRight,
  Warning,
} from "@phosphor-icons/react";
import { redactString } from "@pi-desktop/shared";
import { Component, type ErrorInfo, type ReactNode } from "react";

export type ErrorBoundaryFallbackProps = {
  readonly error: Error;
  readonly redactedMessage: string;
  readonly reset: () => void;
  readonly reload: () => void;
};

export type ErrorBoundaryProps = {
  readonly children: ReactNode;
  /** Human-readable label for the boundary, used in logs + fallback title. */
  readonly name?: string;
  /** Optional custom fallback renderer. */
  readonly fallback?: (props: ErrorBoundaryFallbackProps) => ReactNode;
  /** Called from componentDidCatch with the original (unredacted) error. */
  readonly onError?: (error: Error, info: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  readonly error: Error | null;
  readonly showStack: boolean;
};

/**
 * Robust renderer-side error boundary.
 *
 * React requires a class component for `componentDidCatch` /
 * `getDerivedStateFromError` so this stays as a class. Error messages are
 * scrubbed via the shared `redactString` before display so we never leak
 * paths, tokens, or emails into the UI.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null, showStack: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.name ?? "renderer";
    // eslint-disable-next-line no-console
    console.error(`[error-boundary:${label}] caught render error`, error, info);
    this.props.onError?.(error, info);
  }

  private readonly reset = (): void => {
    this.setState({ error: null, showStack: false });
  };

  private readonly reload = (): void => {
    window.location.reload();
  };

  private readonly toggleStack = (): void => {
    this.setState((prev) => ({ showStack: !prev.showStack }));
  };

  override render(): ReactNode {
    const { error, showStack } = this.state;
    if (!error) {
      return this.props.children;
    }

    const redactedMessage = redactString(
      error.message || "Unknown renderer error",
    );

    if (this.props.fallback) {
      return this.props.fallback({
        error,
        redactedMessage,
        reset: this.reset,
        reload: this.reload,
      });
    }

    const title = this.props.name
      ? `${this.props.name} crashed`
      : "Something went wrong";
    const stack = error.stack ? redactString(error.stack) : null;

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="error-boundary-fallback"
        className="flex h-full min-h-[12rem] w-full items-center justify-center bg-[var(--color-bg-primary)] p-6"
      >
        <div className="flex w-full max-w-lg flex-col gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <Warning className="size-5" weight="fill" />
            <h1 className="text-sm font-semibold">{title}</h1>
          </div>
          <p className="text-[11px] text-white/60">
            The renderer hit an unexpected error. You can try to recover the
            view, or reload the window to start fresh.
          </p>
          <pre
            data-testid="error-boundary-message"
            className="overflow-auto border border-white/[0.08] bg-[var(--color-bg-secondary)] p-3 font-mono text-[10.5px] text-white/80"
          >
            {redactedMessage}
          </pre>

          {stack ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={this.toggleStack}
                aria-expanded={showStack}
                data-testid="error-boundary-toggle-stack"
                className="flex items-center gap-1 self-start text-[10.5px] text-white/50 hover:text-white/80"
              >
                {showStack ? (
                  <CaretDown className="size-3" />
                ) : (
                  <CaretRight className="size-3" />
                )}
                {showStack ? "Hide stack trace" : "Show stack trace"}
              </button>
              {showStack ? (
                <pre
                  data-testid="error-boundary-stack"
                  className="max-h-64 overflow-auto border border-white/[0.06] bg-[var(--color-bg-secondary)] p-3 font-mono text-[10px] text-white/60"
                >
                  {stack}
                </pre>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              data-testid="error-boundary-reset"
              className="flex items-center gap-1.5 border border-white/[0.08] px-3 py-1.5 text-[10.5px] text-white/80 hover:bg-white/[0.04]"
            >
              <ArrowClockwise className="size-3.5" />
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              data-testid="error-boundary-reload"
              className="bg-primary px-3 py-1.5 text-[10.5px] text-primary-foreground hover:opacity-90"
            >
              Reload window
            </button>
          </div>
        </div>
      </div>
    );
  }
}
