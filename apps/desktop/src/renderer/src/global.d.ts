import type { PiDesktopApi } from "@pi-desktop/shared";
import type { FsWatchFn } from "@/lib/file-watcher/file-watcher-stream";

declare global {
  interface Window {
    piDesktop: PiDesktopApi & {
      updates: {
        getState(): Promise<unknown>;
        check(): Promise<unknown>;
        download(): Promise<unknown>;
        install(): Promise<unknown> | unknown;
        subscribe(listener: (state: unknown) => void): () => void;
      };
      fs: PiDesktopApi["fs"] & {
        watch?: FsWatchFn;
      };
    };
  }
}
