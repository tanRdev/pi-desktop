import type { ComponentType, ReactNode } from "react";
import { ErrorBoundary, type ErrorBoundaryProps } from "./error-boundary";

export type WithErrorBoundaryOptions = Omit<ErrorBoundaryProps, "children">;

/**
 * HOC that wraps a component with an `<ErrorBoundary>`. Useful for granular
 * boundaries around expensive or risky leaf components.
 */
export function withErrorBoundary<P extends object>(
  Wrapped: ComponentType<P>,
  options: WithErrorBoundaryOptions = {},
): ComponentType<P> {
  const displayName = Wrapped.displayName ?? Wrapped.name ?? "Component";

  function WithErrorBoundary(props: P): ReactNode {
    return (
      <ErrorBoundary {...options}>
        <Wrapped {...props} />
      </ErrorBoundary>
    );
  }

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}
