import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("terminal surface", () => {
  it("removes terminal chrome and overrides xterm viewport styling to match the app surface", () => {
    const terminalSource = readSource(
      "apps/desktop/src/renderer/src/components/ui/terminal.tsx",
    );

    expect(terminalSource).not.toContain("Pi CLI");
    expect(terminalSource).not.toContain("terminalLabel");
    expect(terminalSource).not.toContain("w-[400px]");
    expect(terminalSource).not.toContain("border-l border-white/[0.06]");
    expect(terminalSource).toContain('background: "var(--color-bg-primary)"');
    expect(terminalSource).toContain('cursorAccent: "var(--color-bg-primary)"');
    expect(terminalSource).toContain(
      'querySelector<HTMLElement>(".xterm-viewport")',
    );
    expect(terminalSource).toContain(
      'querySelector<HTMLElement>(".xterm-screen")',
    );
    expect(terminalSource).toContain(
      'viewport.style.backgroundColor = "var(--color-bg-primary)"',
    );
    expect(terminalSource).toContain('screen.style.height = "100%"');
    expect(terminalSource).toContain(
      '"flex h-full w-full flex-col bg-[var(--color-bg-primary)]"',
    );
  });
});
