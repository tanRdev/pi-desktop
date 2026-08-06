import type { PiDesktopApi } from "@pi-desktop/shared";

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
    };
  }
}
