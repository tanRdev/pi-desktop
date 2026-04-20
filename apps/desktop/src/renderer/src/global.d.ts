import type { PiDesktopApi } from "@pi-desktop/shared";
import type { FsWatchFn } from "@/lib/file-watcher/file-watcher-stream";

declare global {
  interface Window {
    piDesktop: PiDesktopApi & {
      fs: PiDesktopApi["fs"] & {
        watch?: FsWatchFn;
      };
    };
  }
}
