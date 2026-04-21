// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SessionHealthPanel } from "./session-health-panel";
import type { SessionHealthSnapshot } from "./use-session-health";

afterEach(() => {
  cleanup();
});

const CONNECTED_SNAPSHOT: SessionHealthSnapshot = {
  memory: null,
  durationMs: 120000,
  eventCount: 10,
  errorCount: 1,
  errorRate: 0.1,
  connectionStatus: "connected",
};

const MEMORY_SNAPSHOT: SessionHealthSnapshot = {
  memory: {
    usedJsHeapMb: 100,
    totalJsHeapMb: 150,
    jsHeapSizeLimitMb: 512,
  },
  durationMs: 60000,
  eventCount: 5,
  errorCount: 0,
  errorRate: 0,
  connectionStatus: "connected",
};

const OFFLINE_SNAPSHOT: SessionHealthSnapshot = {
  memory: null,
  durationMs: 0,
  eventCount: 0,
  errorCount: 0,
  errorRate: 0,
  connectionStatus: "offline",
};

const RECONNECTING_SNAPSHOT: SessionHealthSnapshot = {
  memory: null,
  durationMs: 0,
  eventCount: 3,
  errorCount: 2,
  errorRate: 2 / 3,
  connectionStatus: "reconnecting",
};

describe("SessionHealthPanel", () => {
  it("renders the panel", () => {
    render(<SessionHealthPanel snapshot={CONNECTED_SNAPSHOT} />);
    expect(screen.getByTestId("session-health-panel")).toBeInTheDocument();
  });

  it("renders duration metric", () => {
    render(<SessionHealthPanel snapshot={CONNECTED_SNAPSHOT} />);
    expect(screen.getByTestId("session-health-duration").textContent).toContain(
      "2m",
    );
  });

  it("renders event count", () => {
    render(<SessionHealthPanel snapshot={CONNECTED_SNAPSHOT} />);
    expect(screen.getByTestId("session-health-events").textContent).toContain(
      "10",
    );
  });

  it("renders error rate", () => {
    render(<SessionHealthPanel snapshot={CONNECTED_SNAPSHOT} />);
    expect(
      screen.getByTestId("session-health-error-rate").textContent,
    ).toContain("10.0%");
  });

  it("renders memory when available", () => {
    render(<SessionHealthPanel snapshot={MEMORY_SNAPSHOT} />);
    expect(screen.getByTestId("session-health-memory").textContent).toContain(
      "100",
    );
  });

  it("hides memory when unavailable", () => {
    render(<SessionHealthPanel snapshot={CONNECTED_SNAPSHOT} />);
    expect(screen.queryByTestId("session-health-memory")).toBeNull();
  });

  it("shows connection status connected", () => {
    render(<SessionHealthPanel snapshot={CONNECTED_SNAPSHOT} />);
    expect(
      screen.getByTestId("session-health-connection").textContent,
    ).toContain("Connected");
  });

  it("shows connection status offline", () => {
    render(<SessionHealthPanel snapshot={OFFLINE_SNAPSHOT} />);
    expect(
      screen.getByTestId("session-health-connection").textContent,
    ).toContain("Offline");
  });

  it("shows connection status reconnecting", () => {
    render(<SessionHealthPanel snapshot={RECONNECTING_SNAPSHOT} />);
    expect(
      screen.getByTestId("session-health-connection").textContent,
    ).toContain("Reconnecting");
  });
});
