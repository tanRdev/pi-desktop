import { Effect } from "effect";

import { fromUnknownError } from "../effect/errors";
import { runEffect } from "../effect/runtime";

type InitialWorkspaceActivationState<Host> = {
  currentHost: Host;
  unsubscribe: () => void;
};

type ActivateWorkspacePath = (
  targetPath: string,
  options?: {
    createIfMissing?: boolean;
  },
) => Promise<void>;

type ActivateInitialWorkspaceSelectionInput<Host> = {
  preferredWorkspacePath: string | null;
  fallbackWorkspacePath: string | null;
  shouldPreserveEmptySelection: boolean;
  state: InitialWorkspaceActivationState<Host>;
  activateWorkspacePath: ActivateWorkspacePath;
  createBootstrapErrorHost(message: string): Host;
  subscribeToHost(host: Host, thread: null): () => void;
};

function replaceWithBootstrapErrorHost<Host>(
  input: ActivateInitialWorkspaceSelectionInput<Host>,
  message: string,
): void {
  const bootstrapErrorHost = input.createBootstrapErrorHost(message);

  input.state.currentHost = bootstrapErrorHost;
  input.state.unsubscribe();
  input.state.unsubscribe = input.subscribeToHost(bootstrapErrorHost, null);
}

export async function activateInitialWorkspaceSelection<Host>(
  input: ActivateInitialWorkspaceSelectionInput<Host>,
): Promise<void> {
  const { preferredWorkspacePath } = input;

  if (preferredWorkspacePath === null) {
    const bootstrapErrorHost = input.createBootstrapErrorHost(
      "No workspace selected",
    );

    input.state.currentHost = bootstrapErrorHost;
    input.state.unsubscribe();
    input.state.unsubscribe = input.subscribeToHost(bootstrapErrorHost, null);
    return;
  }

  await runEffect(
    Effect.tryPromise({
      try: () =>
        input.activateWorkspacePath(preferredWorkspacePath, {
          createIfMissing: !input.shouldPreserveEmptySelection,
        }),
      catch: (error) => fromUnknownError(error, "activateWorkspacePath"),
    }).pipe(
      Effect.catchAll((error) => {
        const fallbackWorkspacePath = input.fallbackWorkspacePath;

        if (
          fallbackWorkspacePath &&
          preferredWorkspacePath !== fallbackWorkspacePath
        ) {
          return Effect.tryPromise({
            try: () => input.activateWorkspacePath(fallbackWorkspacePath),
            catch: (fallbackError) =>
              fromUnknownError(fallbackError, "activateWorkspacePath fallback"),
          }).pipe(
            Effect.catchAll((fallbackError) =>
              Effect.sync(() => {
                replaceWithBootstrapErrorHost(input, fallbackError.message);
              }),
            ),
          );
        }

        return Effect.sync(() => {
          replaceWithBootstrapErrorHost(input, error.message);
        });
      }),
    ),
  );
}
