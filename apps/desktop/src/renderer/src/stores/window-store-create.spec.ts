import { describe, expect, it } from "vitest";

import {
  createWindowFromAction,
  getCenteredWindowPosition,
} from "./window-store-create";

describe("window-store-create", () => {
  it("creates terminal windows with fallback cwd and default dimensions", () => {
    const window = createWindowFromAction(
      { kind: "terminal", backend: "shell" },
      [],
      3,
      "/tmp/worktree",
    );

    expect(window.kind).toBe("terminal");
    if (window.kind !== "terminal") {
      throw new Error("Expected terminal window");
    }

    expect(window.cwd).toBe("/tmp/worktree");
    expect(window.width).toBe(640);
    expect(window.height).toBe(420);
    expect(window.zIndex).toBe(3);
  });

  it("uses explicit creation coordinates and sizes when provided", () => {
    const window = createWindowFromAction(
      { kind: "file", filePath: "/tmp/example.ts" },
      [],
      1,
      undefined,
      {
        x: 24,
        y: 48,
        width: 800,
        height: 600,
      },
    );

    expect(window.x).toBe(24);
    expect(window.y).toBe(48);
    expect(window.width).toBe(800);
    expect(window.height).toBe(600);
  });

  it("centers windows against zoomed and panned viewports", () => {
    expect(
      getCenteredWindowPosition({
        viewportWidth: 1440,
        viewportHeight: 900,
        windowWidth: 640,
        windowHeight: 420,
        zoom: 0.9,
        panX: 90,
        panY: -45,
      }),
    ).toEqual({ x: 380, y: 340 });
  });
});
