/// <reference types="vite/client" />

declare module "*?modulePath" {
  const modulePath: string;
  export default modulePath;
}

interface Window {
  pidesk: import("@pidesk/shared").PiDeskApi;
}
