import type { PiDesktopApi } from "@pi-desktop/shared";

declare global {
  interface Window {
    piDesktop: PiDesktopApi;
  }
}
