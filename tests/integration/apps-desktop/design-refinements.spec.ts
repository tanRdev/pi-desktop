import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("design refinements – CSS foundation", () => {
  const shellCss = () => readSource("packages/ui/src/styles/pidesk-shell.css");
  const appCss = () => readSource("apps/desktop/src/renderer/src/app.css");

  it("uses refined surface depth progression", () => {
    const css = shellCss();
    // Surface layers should be distinct enough to create visual depth
    expect(css).toContain("--surface-1: #121212");
    expect(css).toContain("--surface-2: #1a1a1a");
    expect(css).toContain("--surface-3: #212121");
    expect(css).toContain("--surface-4: #282828");
  });

  it("has a shadow-xs token for micro-elevation", () => {
    const css = shellCss();
    expect(css).toContain("--shadow-xs:");
  });

  it("shell-token includes font-weight: 500 for legibility", () => {
    const css = shellCss();
    // Extract shell-token block
    const tokenMatch = css.match(/\.shell-token\s*\{[^}]+\}/);
    expect(tokenMatch).not.toBeNull();
    expect(tokenMatch?.[0]).toContain("font-weight: 500");
  });

  it("chrome-eyebrow uses refined typography (11px, weight 500, 0.14em tracking)", () => {
    const css = appCss();
    const eyebrowMatch = css.match(/\.chrome-eyebrow\s*\{[^}]+\}/);
    expect(eyebrowMatch).not.toBeNull();
    const block = eyebrowMatch?.[0];
    expect(block).toContain("font-size: 11px");
    expect(block).toContain("font-weight: 500");
    expect(block).toContain("letter-spacing: 0.14em");
  });

  it("chrome-empty-state utility exists with flat background (no dashed borders)", () => {
    const css = appCss();
    expect(css).toContain(".chrome-empty-state");
    const emptyMatch = css.match(/\.chrome-empty-state\s*\{[^}]+\}/);
    expect(emptyMatch).not.toBeNull();
    const block = emptyMatch?.[0];
    expect(block).toContain("border-radius: var(--radius-md)");
    expect(block).toContain("background:");
    expect(block).not.toContain("border-style");
    expect(block).not.toContain("dashed");
  });

  it("chrome-divider utility exists for subtle section breaks", () => {
    const css = appCss();
    expect(css).toContain(".chrome-divider");
    const dividerMatch = css.match(/\.chrome-divider\s*\{[^}]+\}/);
    expect(dividerMatch).not.toBeNull();
    expect(dividerMatch?.[0]).toContain("height: 1px");
  });

  it("muted-foreground uses lower lightness for stronger dimming", () => {
    const css = shellCss();
    // Muted foreground should be ≤ 58% lightness for proper contrast
    const match = css.match(/--muted-foreground:\s*oklch\((\d+)%/);
    expect(match).not.toBeNull();
    const lightness = Number.parseInt(match?.[1] ?? "0", 10);
    expect(lightness).toBeLessThanOrEqual(58);
  });

  it("border opacity is tuned for visible but non-intrusive edges", () => {
    const css = shellCss();
    // Border should use moderate opacity (0.4-0.5 range)
    const borderMatch = css.match(/--border:\s*oklch\([^)]+\/\s*([\d.]+)\)/);
    expect(borderMatch).not.toBeNull();
    const opacity = Number.parseFloat(borderMatch?.[1] ?? "0");
    expect(opacity).toBeGreaterThanOrEqual(0.4);
    expect(opacity).toBeLessThanOrEqual(0.55);
  });
});

describe("design refinements – sidebar components", () => {
  const sidebarSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    );
  const worktreeSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/worktree-section.tsx",
    );
  const threadSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/thread-list-item.tsx",
    );

  it("left sidebar removes the old repository summary card entirely", () => {
    const src = sidebarSrc();
    expect(src).not.toContain("ProjectAvatar");
    expect(src).not.toContain("ProjectCustomizationMenu");
    expect(src).not.toContain("repository.defaultBranch");
  });

  it("empty states use chrome-empty-state instead of dashed borders", () => {
    const src = sidebarSrc();
    expect(src).toContain("chrome-empty-state");
    // No dashed border patterns in sidebar
    expect(src).not.toContain("border-dashed");
    expect(src).not.toContain("rounded-2xl border border-dashed");
  });

  it("worktree section uses the shared git status chip instead of bespoke badges", () => {
    const src = worktreeSrc();
    expect(src).toContain("<GitStatusChip git={worktree.git} />");
    expect(src).not.toContain("rounded-full border border-border bg-surface-1");
  });

  it("worktree section uses tighter padding and spacing", () => {
    const src = worktreeSrc();
    expect(src).toContain("rounded-md px-2 py-1.5");
    expect(src).toContain("space-y-0.5");
    expect(src).not.toContain("space-y-1 pl-8");
  });

  it("worktree empty state uses chrome-empty-state", () => {
    const src = worktreeSrc();
    expect(src).toContain("chrome-empty-state");
    expect(src).not.toContain("rounded-lg border border-dashed");
  });

  it("thread list items use tighter vertical rhythm", () => {
    const src = threadSrc();
    // Should use rounded-md py-1.5 (not rounded-lg py-2)
    expect(src).toContain("rounded-md px-2 py-1.5");
    expect(src).not.toContain("rounded-lg px-2 py-2");
  });

  it("thread active state uses transparent alpha for subtlety", () => {
    const src = threadSrc();
    expect(src).toContain("bg-surface-3/80");
  });

  it("thread row uses semantic color tokens instead of raw opacity", () => {
    const src = threadSrc();
    // Thread chrome should use design-system color tokens
    expect(src).toContain("text-muted-foreground");
    // Should NOT use opacity hacks for dimming
    expect(src).not.toContain("opacity-60");
  });
});

describe("design refinements – shell chrome & layout", () => {
  const shellSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    );
  const dockSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    );
  const titleSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    );
  const railSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    );
  const statusSrc = () =>
    readSource(
      "apps/desktop/src/renderer/src/components/workspace/status-bar.tsx",
    );

  it("workspace empty state uses subtle solid border instead of dashed", () => {
    const src = shellSrc();
    expect(src).toContain("rounded-lg border border-border/40 bg-surface-1/80");
    expect(src).not.toContain("border-dashed");
    expect(src).not.toContain("rounded-2xl border border-dashed");
  });

  it("prompt dock tokens have no individual borders (cleaner look)", () => {
    const src = dockSrc();
    // Status tokens should NOT have individual borders
    const tokenLines = src
      .split("\n")
      .filter((line) => line.includes("shell-token"));
    for (const line of tokenLines) {
      expect(line).not.toContain("border border-border-subtle");
    }
  });

  it("prompt dock tokens use transparent surface for cohesion", () => {
    const src = dockSrc();
    expect(src).toContain("bg-surface-2/80");
    // Tokens should use py-0.5 for tighter sizing
    expect(src).toContain("py-0.5");
  });

  it("prompt dock token area uses tighter gap (gap-1.5)", () => {
    const src = dockSrc();
    // Token gap should be 1.5 not 2
    expect(src).toContain("gap-1.5");
  });

  it("prompt dock send button has transition-colors for smooth interaction", () => {
    const src = dockSrc();
    expect(src).toContain("transition-colors");
  });

  it("title bar uses refined spacing (gap-2.5)", () => {
    const src = titleSrc();
    expect(src).toContain("gap-2.5");
  });

  it("left rail bottom section uses tighter spacing", () => {
    const src = railSrc();
    expect(src).toContain("gap-1.5");
    expect(src).toContain("py-2.5");
    // Should NOT use the looser original spacing
    expect(src).not.toContain("gap-2 py-3");
  });

  it("status bar uses proportional sizing (10px text, 1.5×1.5 dot)", () => {
    const src = statusSrc();
    expect(src).toContain("text-[10px]");
    expect(src).toContain("h-1.5 w-1.5");
    expect(src).toContain("gap-1.5");
  });

  it("prompt dock removes the old enter-to-send helper chrome", () => {
    const src = dockSrc();
    expect(src).not.toContain("Enter to send");
    expect(src).not.toContain("tracking-[0.1em]");
  });
});

describe("design refinements – no design anti-patterns", () => {
  const allWorkspaceFiles = [
    "apps/desktop/src/renderer/src/components/workspace/left-sidebar.tsx",
    "apps/desktop/src/renderer/src/components/workspace/project-customization-menu.tsx",
    "apps/desktop/src/renderer/src/components/workspace/worktree-section.tsx",
    "apps/desktop/src/renderer/src/components/workspace/thread-list-item.tsx",
    "apps/desktop/src/renderer/src/components/workspace/workspace-shell.tsx",
    "apps/desktop/src/renderer/src/components/workspace/prompt-dock.tsx",
    "apps/desktop/src/renderer/src/components/workspace/title-bar.tsx",
    "apps/desktop/src/renderer/src/components/workspace/left-rail.tsx",
    "apps/desktop/src/renderer/src/components/workspace/status-bar.tsx",
  ];

  it("no dashed borders remain in workspace components", () => {
    for (const file of allWorkspaceFiles) {
      const src = readSource(file);
      expect(src).not.toContain("border-dashed");
    }
  });

  it("no rounded-2xl in workspace components (max radius is rounded-lg)", () => {
    for (const file of allWorkspaceFiles) {
      const src = readSource(file);
      expect(src).not.toContain("rounded-2xl");
    }
  });

  it("no decorative blur or gradient overlays in workspace shell", () => {
    for (const file of allWorkspaceFiles) {
      const src = readSource(file);
      expect(src).not.toContain("backdrop-blur");
      expect(src).not.toContain("bg-gradient-to");
    }
  });
});
