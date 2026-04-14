import type { PiDeskApi } from "@pidesk/shared";

declare global {
  interface Window {
    pidesk: PiDeskApi;
  }
}
