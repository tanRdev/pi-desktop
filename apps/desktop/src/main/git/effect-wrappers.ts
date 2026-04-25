import { Effect } from "effect";

type SyncEffectInput<A, E> = {
  try(): A;
  catch(error: unknown): E;
};

type AsyncEffectInput<A, E> = {
  try(): Promise<A>;
  catch(error: unknown): E;
};

export function createGitSyncEffect<A, E>(
  input: SyncEffectInput<A, E>,
): Effect.Effect<A, E> {
  return Effect.try({
    try: input.try,
    catch: input.catch,
  });
}

export function createGitAsyncEffect<A, E>(
  input: AsyncEffectInput<A, E>,
): Effect.Effect<A, E> {
  return Effect.tryPromise({
    try: input.try,
    catch: input.catch,
  });
}
