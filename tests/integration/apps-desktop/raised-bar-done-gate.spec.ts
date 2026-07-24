import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../../");

describe("Raised architectural bar done-gate", () => {
  it("Spines 1–7 keystone artifacts are present", () => {
    const required = [
      "packages/contracts/src/channels.ts",
      "apps/desktop/src/main/catalogs/workspace-session-catalog.ts",
      "apps/desktop/src/main/session/session-capability.ts",
      "apps/desktop/src/main/bootstrap/desktop-main-layer.ts",
      "apps/desktop/src/main/git/git-service.ts",
      "packages/ui/src/styles/fonts.css",
      "packages/agent-host/src/session-server/socket-bridge.ts",
      "packages/agent-host/src/host/command-handler.ts",
      "tests/e2e/smoke-mock-agent.spec.ts",
      "playwright.config.ts",
    ];

    for (const relativePath of required) {
      expect(
        fs.existsSync(path.join(ROOT, relativePath)),
        `missing ${relativePath}`,
      ).toBe(true);
    }
  });

  it("dormant MessagePort agent-host path is gone", () => {
    expect(
      fs.existsSync(
        path.join(ROOT, "packages/agent-host/src/utility-process/bridge.ts"),
      ),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(ROOT, "apps/desktop/src/main/agent-host-entry.ts"),
      ),
    ).toBe(false);
  });

  it("desktop no longer dual-loads fonts or Button shim", () => {
    const appCss = fs.readFileSync(
      path.join(ROOT, "apps/desktop/src/renderer/src/app.css"),
      "utf8",
    );
    expect(appCss).toContain("@pi-desktop/ui/styles/fonts.css");
    expect(appCss).not.toContain("@fontsource-variable/dm-sans");
    expect(
      fs.existsSync(
        path.join(
          ROOT,
          "apps/desktop/src/renderer/src/components/ui/button.tsx",
        ),
      ),
    ).toBe(false);
  });

  it("desktop accent/font story stays on @pi-desktop/ui (no Inter/SCP/JetBrains)", () => {
    const appCss = fs.readFileSync(
      path.join(ROOT, "apps/desktop/src/renderer/src/app.css"),
      "utf8",
    );
    expect(appCss).toContain("--color-accent: var(--accent)");
    expect(appCss).not.toMatch(/Inter|Source Code Pro|JetBrains/i);

    const terminalTsx = fs.readFileSync(
      path.join(
        ROOT,
        "apps/desktop/src/renderer/src/components/ui/terminal.tsx",
      ),
      "utf8",
    );
    expect(terminalTsx).toContain("--app-font-mono");
    expect(terminalTsx).toContain("IBM Plex Mono");
    expect(terminalTsx).not.toMatch(/JetBrains|Source Code Pro|Inter/i);

    const terminalSettings = fs.readFileSync(
      path.join(
        ROOT,
        "apps/desktop/src/renderer/src/features/settings/sections/terminal.tsx",
      ),
      "utf8",
    );
    expect(terminalSettings).toContain('placeholder="IBM Plex Mono"');
    expect(terminalSettings).not.toMatch(/Source Code Pro|Inter|JetBrains/i);

    const monaco = fs.readFileSync(
      path.join(
        ROOT,
        "apps/desktop/src/renderer/src/features/workspace/components/monaco-file-editor.tsx",
      ),
      "utf8",
    );
    expect(monaco).toContain("IBM Plex Mono");
    expect(monaco).not.toMatch(/Source Code Pro|Inter|JetBrains/i);

    const fontsCss = fs.readFileSync(
      path.join(ROOT, "packages/ui/src/styles/fonts.css"),
      "utf8",
    );
    expect(fontsCss).toContain("@fontsource-variable/dm-sans");
    expect(fontsCss).toContain("@fontsource/ibm-plex-mono");
    expect(fontsCss).not.toMatch(/Inter|Source Code Pro|JetBrains/i);
  });
});
