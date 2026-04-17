import { Warning } from "@phosphor-icons/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("Renderer error boundary caught error", error, info);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-lg flex-col gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <Warning className="size-5" weight="fill" />
            <h1 className="font-semibold">Something went wrong</h1>
          </div>
          <p className="text-muted-foreground">
            The desktop renderer hit an unexpected error. You can try to
            continue, or reload the window to start fresh.
          </p>
          <pre className="overflow-auto border border-border bg-muted p-3 font-mono text-xs">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="border border-border px-3 py-1.5 hover:bg-muted"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
            >
              Reload window
            </button>
          </div>
        </div>
      </div>
    );
  }
}
