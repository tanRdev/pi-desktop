import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../");
const BOOTSTRAP = path.join(
  ROOT,
  "apps/desktop/src/main/bootstrap/bootstrap-desktop.ts",
);
const RUNTIME = path.join(ROOT, "apps/desktop/src/main/effect/runtime.ts");
const LAYER = path.join(
  ROOT,
  "apps/desktop/src/main/bootstrap/desktop-main-layer.ts",
);

describe("Spine 3 Effect bootstrap done-gate", () => {
  it("main installs the composed Desktop main Layer at boot", () => {
    const bootstrap = fs.readFileSync(BOOTSTRAP, "utf8");
    expect(bootstrap).toContain("installDesktopMainRuntime");
    expect(bootstrap).toContain("createDesktopMainLayer");
    expect(bootstrap).toContain("createSessionCapability");
    expect(bootstrap).not.toMatch(/let currentContext/);
    expect(bootstrap).not.toMatch(/let currentHost/);
    expect(bootstrap).not.toMatch(/let currentTransport/);
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
    expect(layer).toContain("GitServiceLive");
    expect(layer).toContain("TerminalManagerLive");
    expect(layer).toContain("SessionCapabilityLive");
  });
});
