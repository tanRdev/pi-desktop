import { type PiDeskApi } from "@pidesk/shared";
import { createMockPiDeskApi } from "./mock-api";

// Initialize the mock API on window for the web app
export function initializeMockApi(): void {
  if (typeof window !== "undefined") {
    window.piDeskApi = createMockPiDeskApi() as unknown as Window["piDeskApi"];
  }
}

// Get the API (works in both mock and real environments)
export function getPiDeskApi(): PiDeskApi {
  if (typeof window === "undefined") {
    throw new Error("getPiDeskApi can only be called in browser environment");
  }

  if (!window.piDeskApi) {
    // Auto-initialize mock API for web
    initializeMockApi();
  }

  return window.piDeskApi as unknown as PiDeskApi;
}
