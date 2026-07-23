import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../");
const MAIN_INDEX = path.join(ROOT, "apps/desktop/src/main/index.ts");
const RUNTIME = path.join(ROOT, "apps/desktop/src/main/effect/runtime.ts");
const LAYER = path.join(
  ROOT,
  "apps/desktop/src/main/bootstrap/desktop-main-layer.ts",
);

describe("Spine 3 Effect bootstrap done-gate", () => {
  it("main installs the composed Desktop main Layer at boot", () => {
    const index = fs.readFileSync(MAIN_INDEX, "utf8");
    expect(index).toContain("installDesktopMainRuntime");
    expect(index).toContain("createDesktopMainLayer");
    expect(index).toContain("createSessionCapability");
    expect(index).not.toMatch(/let currentContext/);
    expect(index).not.toMatch(/let currentHost/);
    expect(index).not.toMatch(/let currentTransport/);
  });

  it("runEffect provides the installed main Layer, not logger-only theater", () => {
    const runtime = fs.readFileSync(RUNTIME, "utf8");
    expect(runtime).toContain("installDesktopMainRuntime");
    expect(runtime).toContain("installedMainLayer");
    expect(runtime).toMatch(/Effect\.provide\(installedMainLayer/);
  });

  it("Desktop main Layer merges catalog, git, terminal, and session services", () => {
    const layer = fs.readFileSync(LAYER, "utf8");
    expect(layer).toContain("RepositoryCatalogLive");
    expect(layer).toContain("GitWorktreeServiceLive");
    expect(layer).toContain("TerminalManagerLive");
    expect(layer).toContain("SessionCapabilityLive");
  });
});
