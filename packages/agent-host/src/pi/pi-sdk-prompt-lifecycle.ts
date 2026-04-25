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
  prompt: (text: string) => Promise<void>;
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
    async prompt(text: string): Promise<void> {
      const session = getSession();

      if (!session) {
        throw new Error(
          "Pi Desktop Pi SDK runtime failed to initialize a session",
        );
      }

      setStreamingState();

      const abortController = new AbortController();
      promptAbortController = abortController;

      try {
        await session.prompt(text, { signal: abortController.signal });
        refreshReadyState();
      } catch (error) {
        if (abortController.signal.aborted) {
          refreshReadyState();
          return;
        }

        setErrorState(error, session.sessionId);
        throw error;
      } finally {
        if (promptAbortController === abortController) {
          promptAbortController = null;
        }
      }
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
