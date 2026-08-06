import {
  createContractInvoker,
  createContractSubscriber,
  fsContracts,
} from "@pi-desktop/contracts";
import type { FileChangeEvent } from "@pi-desktop/shared";

import type { PreloadInvoke, PreloadOn } from "./updates-api";

export type FsWatch = (
  path: string,
  onEvent: (event: FileChangeEvent) => void,
) => () => void;

/**
 * Subscribes to `fs:event` pushes for one directory and asks the main process
 * to run a native watcher for it. The returned function tears both down.
 */
export function createFsWatch({
  invoke,
  on,
}: {
  invoke: PreloadInvoke;
  on: PreloadOn;
}): FsWatch {
  const invokeContract = createContractInvoker(invoke);
  const subscribeContract = createContractSubscriber(on);

  return (path, onEvent) => {
    const unsubscribe = subscribeContract(fsContracts.event, (payload) => {
      if (payload.watchPath === path) {
        onEvent(payload);
      }
    });
    invokeContract(fsContracts.watch, { path }).catch(() => {
      // Watcher failed to start (e.g. no workspace root yet); stop listening.
      unsubscribe();
    });
    return () => {
      unsubscribe();
      invokeContract(fsContracts.unwatch, { path }).catch(() => {
        // Best-effort cleanup; the main process also drops watchers whose
        // renderer sender has been destroyed.
      });
    };
  };
}
