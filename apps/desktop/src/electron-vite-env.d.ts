/// <reference types="vite/client" />

declare module "*?modulePath" {
  const modulePath: string;
  export default modulePath;
}

interface Window {
  piDesktop: import("@pi-desktop/shared").PiDesktopApi;
}
