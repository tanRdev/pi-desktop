import {
  type createContractInvoker,
  type createContractSubscriber,
  fsContracts,
} from "@pi-desktop/contracts";
import type { FileChangeEvent, PiDesktopApi } from "@pi-desktop/shared";

export interface CreateFsApiDependencies {
  invokeContract: ReturnType<typeof createContractInvoker>;
  subscribeContract: ReturnType<typeof createContractSubscriber>;
}

/**
 * Filesystem preload API. `watch` is backed by the typed `fs:watch` /
 * `fs:unwatch` invoke contracts plus the shared `fs:changed` event contract:
 * subscribing starts a recursive main-process watch for the root, and the
 * returned unsubscribe stops it again.
 */
export function createFsApi({
  invokeContract,
  subscribeContract,
}: CreateFsApiDependencies): PiDesktopApi["fs"] {
  return {
    readDirectory(path: string) {
      return invokeContract(fsContracts.readDirectory, { path }) as Promise<
        import("@pi-desktop/shared").DirectoryListing
      >;
    },
    readFile(path: string) {
      return invokeContract(fsContracts.readFile, { path });
    },
    writeFile(path: string, content: string) {
      return invokeContract(fsContracts.writeFile, { path, content });
    },
    deleteFile(path: string) {
      return invokeContract(fsContracts.deleteFile, { path });
    },
    renameFile(oldPath: string, newPath: string) {
      return invokeContract(fsContracts.renameFile, { oldPath, newPath });
    },
    moveFile(sourcePath: string, destinationPath: string) {
      return invokeContract(fsContracts.moveFile, {
        sourcePath,
        destinationPath,
      });
    },
    watch(path: string, listener: (event: FileChangeEvent) => void) {
      // The main process pushes changes for every watched root on the
      // shared `fs:changed` channel; forward only this root's events.
      const unsubscribe = subscribeContract(
        fsContracts.changed,
        (event: FileChangeEvent) => {
          if (
            event.path === path ||
            event.path.startsWith(`${path}/`) ||
            event.path.startsWith(`${path}\\`)
          ) {
            listener(event);
          }
        },
      );
      void invokeContract(fsContracts.watch, { path }).catch(() => undefined);
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        unsubscribe();
        void invokeContract(fsContracts.unwatch, { path }).catch(
          () => undefined,
        );
      };
    },
  };
}
