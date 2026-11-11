import type { PromptImageAttachment } from "@pi-desktop/shared";

type PromptLifecycleSession = {
  sessionId: string;
  prompt: (text: string, options?: object) => Promise<void>;
  waitForIdle?: () => Promise<void>;
};

type PiSdkPromptLifecycleOptions = {
  getSession: () => PromptLifecycleSession | null;
  setStreamingState: () => void;
  refreshReadyState: () => void;
  setErrorState: (error: unknown, sessionId: string) => void;
};

type PiSdkPromptLifecycle = {
  prompt: (text: string, images?: PromptImageAttachment[]) => Promise<void>;
  cancel: () => Promise<void>;
};

export const createPiSdkPromptLifecycle = ({
  getSession,
  setStreamingState,
  refreshReadyState,
  setErrorState,
}: PiSdkPromptLifecycleOptions): PiSdkPromptLifecycle => {
  let promptAbortController: AbortController | null = null;

  return {
    // Prompt acceptance is separated from turn completion: the returned
    // promise resolves as soon as the SDK reports preflight acceptance
    // (the same signal Pi's RPC mode uses to ack a prompt command) and
    // rejects only when the prompt is refused before acceptance. The turn
    // itself keeps running in the background; its progress and completion
    // arrive through session events, and a failure after acceptance is
    // recorded via setErrorState instead of rejecting a call that was
    // already acknowledged. Callers must therefore never retry a prompt
    // whose acceptance is uncertain — it may already be running.
    async prompt(
      text: string,
      images?: PromptImageAttachment[],
    ): Promise<void> {
      const session = getSession();

      if (!session) {
        throw new Error(
          "Pi Desktop Pi SDK runtime failed to initialize a session",
        );
      }

      setStreamingState();

      const abortController = new AbortController();
      promptAbortController = abortController;

      let accepted = false;
      let resolveAccepted!: () => void;
      let rejectAccepted!: (error: unknown) => void;
      const acceptance = new Promise<void>((resolve, reject) => {
        resolveAccepted = resolve;
        rejectAccepted = reject;
      });

      const turn = (async (): Promise<void> => {
        try {
          await session.prompt(text, {
            signal: abortController.signal,
            ...(images && images.length > 0 ? { images } : {}),
            preflightResult: (success: boolean) => {
              if (success && !accepted) {
                accepted = true;
                resolveAccepted();
              }
            },
          });
          refreshReadyState();
          if (!accepted) {
            // Sessions that never report preflight (test doubles, commands
            // handled synchronously) accept by completing successfully.
            accepted = true;
            resolveAccepted();
          }
        } catch (error) {
          if (abortController.signal.aborted) {
            refreshReadyState();
            if (!accepted) {
              accepted = true;
              resolveAccepted();
            }
            return;
          }

          setErrorState(error, session.sessionId);
          if (!accepted) {
            accepted = true;
            rejectAccepted(error);
          }
        } finally {
          if (promptAbortController === abortController) {
            promptAbortController = null;
          }
        }
      })();
      // The turn's outcome is fully handled above (ready/error state);
      // guard only against a state callback itself throwing.
      turn.catch(() => undefined);

      return acceptance;
    },

    async cancel(): Promise<void> {
      const abortController = promptAbortController;

      if (!abortController || abortController.signal.aborted) {
        return;
      }

      abortController.abort();

      const session = getSession();

      if (session?.waitForIdle) {
        await session.waitForIdle().then(undefined, () => undefined);
      }

      refreshReadyState();
    },
  };
};

export type { PromptLifecycleSession };
