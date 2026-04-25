type SessionOperationOptions = {
  persist?: boolean;
};

type SessionOperationState<Session> = {
  activeWorktreeId: string | null;
  activeWorktreeVersion: number;
  sessionsByWorktreeId: Record<string, Session>;
};

type SessionOperationStore<State> = {
  getState: () => State;
  setState: (updater: (state: State) => State) => void;
};

type UpdateSessionRecord<Session> = (
  sessionsByWorktreeId: Record<string, Session>,
  worktreeId: string,
  updater: (session: Session) => Session,
) => Record<string, Session>;

type CreateWorkspaceSessionOperationHelpersOptions<
  State extends SessionOperationState<Session>,
  Session,
> = SessionOperationStore<State> & {
  persistDelayMs: number;
  persistSession: (session: Session) => Promise<void> | void;
  updateSessionRecord: UpdateSessionRecord<Session>;
};

export function createWorkspaceSessionOperationHelpers<
  State extends SessionOperationState<Session>,
  Session,
>({
  getState,
  setState,
  persistDelayMs,
  persistSession,
  updateSessionRecord,
}: CreateWorkspaceSessionOperationHelpersOptions<State, Session>) {
  const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function schedulePersist(worktreeId: string): void {
    const existing = persistTimers.get(worktreeId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      persistTimers.delete(worktreeId);
      const session = getState().sessionsByWorktreeId[worktreeId];
      if (!session) {
        return;
      }
      void persistSession(session);
    }, persistDelayMs);

    persistTimers.set(worktreeId, timer);
  }

  function withActiveSession(
    updater: (session: Session) => Session,
    options?: SessionOperationOptions,
  ): void {
    const worktreeId = getState().activeWorktreeId;
    if (!worktreeId) {
      return;
    }

    withSession(worktreeId, updater, options);
  }

  function withSession(
    worktreeId: string,
    updater: (session: Session) => Session,
    options?: SessionOperationOptions,
  ): void {
    setState((state) => {
      if (!state.sessionsByWorktreeId[worktreeId]) {
        return state;
      }

      return {
        ...state,
        sessionsByWorktreeId: updateSessionRecord(
          state.sessionsByWorktreeId,
          worktreeId,
          updater,
        ),
      };
    });

    if (options?.persist !== false) {
      schedulePersist(worktreeId);
    }
  }

  function removeWorktreeSession(worktreeId: string): void {
    const persistTimer = persistTimers.get(worktreeId);
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimers.delete(worktreeId);
    }

    setState((state) => {
      if (!state.sessionsByWorktreeId[worktreeId]) {
        return state;
      }

      const { [worktreeId]: _removed, ...remaining } =
        state.sessionsByWorktreeId;

      return {
        ...state,
        sessionsByWorktreeId: remaining,
        ...(state.activeWorktreeId === worktreeId
          ? {
              activeWorktreeId: null,
              activeWorktreeVersion: state.activeWorktreeVersion + 1,
            }
          : {}),
      };
    });
  }

  return {
    withActiveSession,
    withSession,
    removeWorktreeSession,
  };
}
