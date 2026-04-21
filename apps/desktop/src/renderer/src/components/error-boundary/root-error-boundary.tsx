import type { ReactNode } from "react";
import { ErrorBoundary, type ErrorBoundaryProps } from "./error-boundary";

export type RootErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly onError?: ErrorBoundaryProps["onError"];
};

/**
 * Top-level boundary intended to wrap the entire app tree. Distinguished
 * from {@link ErrorBoundary} by a fixed name so render errors at the root
 * are easy to spot in logs.
 */
export function RootErrorBoundary(props: RootErrorBoundaryProps): ReactNode {
  return (
    <ErrorBoundary name="Pi Desktop" onError={props.onError}>
      {props.children}
    </ErrorBoundary>
  );
}
