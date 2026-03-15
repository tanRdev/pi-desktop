import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../");

function read(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function assertExists(filePath: string) {
  if (!fs.existsSync(filePath))
    throw new Error(`Expected file to exist: ${filePath}`);
}

describe("shared ui package foundation (chunk-2a-ui-foundation)", () => {
  it("packages/ui src/index.ts exists", () => {
    const p = path.join(ROOT, "packages/ui/src/index.ts");
    assertExists(p);
  });

  it("packages/ui styles/pidesk-shell.css exists and contains shell tokens", () => {
    const p = path.join(ROOT, "packages/ui/src/styles/pidesk-shell.css");
    const content = read(p);
    if (content === null) throw new Error(`Missing ${p}`);
    if (!content.includes("--background: #0a0a0a;"))
      throw new Error("Expected --background: #0a0a0a; in pidesk-shell.css");
    if (!content.includes("--radius: 0.375rem;"))
      throw new Error("Expected --radius: 0.375rem; in pidesk-shell.css");
    if (!content.includes("::-webkit-scrollbar"))
      throw new Error("Expected ::-webkit-scrollbar in pidesk-shell.css");
    if (!/--app-font-sans:\s*"Inter",\s*"SF Pro Display"/m.test(content))
      throw new Error("Expected --app-font-sans token in pidesk-shell.css");
  });

  it("apps/web/src/app.css imports @pidesk/ui/styles/pidesk-shell.css", () => {
    const p = path.join(ROOT, "apps/web/src/app.css");
    const content = read(p);
    if (content === null) throw new Error(`Missing ${p}`);
    const importRe =
      /@import\s+(?:url\()?['"]@pidesk\/ui\/styles\/pidesk-shell\.css['"]\)?/m;
    if (
      !importRe.test(content) &&
      !content.includes("@pidesk/ui/styles/pidesk-shell.css")
    ) {
      throw new Error(
        `Expected ${p} to import @pidesk/ui/styles/pidesk-shell.css`,
      );
    }
  });

  it("apps/desktop/src/renderer/src/app.css imports shared styles and retains drag-region rules", () => {
    const p = path.join(ROOT, "apps/desktop/src/renderer/src/app.css");
    const content = read(p);
    if (content === null) throw new Error(`Missing ${p}`);
    const importRe =
      /@import\s+(?:url\()?['"]@pidesk\/ui\/styles\/pidesk-shell\.css['"]\)?/m;
    if (
      !importRe.test(content) &&
      !content.includes("@pidesk/ui/styles/pidesk-shell.css")
    ) {
      throw new Error(
        `Expected ${p} to import @pidesk/ui/styles/pidesk-shell.css`,
      );
    }
    if (!content.includes("-webkit-app-region: drag"))
      throw new Error(`Expected ${p} to retain -webkit-app-region: drag rule`);
    if (!content.includes('[data-drag-region="true"]'))
      throw new Error(
        `Expected ${p} to retain [data-drag-region="true"] selector`,
      );
  });

  it("packages/ui src/index.ts re-exports required named exports", () => {
    const indexPath = path.join(ROOT, "packages/ui/src/index.ts");
    const indexContent = read(indexPath);
    if (indexContent === null) throw new Error(`Missing ${indexPath}`);

    const fsRead = (p: string) =>
      fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;

    function resolveTarget(baseFile: string, fromPath: string): string | null {
      if (!fromPath.startsWith(".")) return null;
      const baseDir = path.dirname(baseFile);
      const candidates = [
        fromPath,
        `${fromPath}.ts`,
        `${fromPath}.tsx`,
        `${fromPath}.js`,
        `${fromPath}.jsx`,
        `${fromPath}/index.ts`,
        `${fromPath}/index.tsx`,
        `${fromPath}/index.js`,
        `${fromPath}/index.jsx`,
      ];
      for (const c of candidates) {
        const fp = path.resolve(baseDir, c);
        if (fs.existsSync(fp)) return fp;
      }
      return null;
    }

    function collectExports(
      filePath: string,
      depth = 0,
      collected = new Set<string>(),
    ): Set<string> {
      if (depth > 5) return collected;
      if (!fs.existsSync(filePath)) return collected;
      const content = fsRead(filePath) || "";
      const localDecl =
        /export\s+(?:const|let|var|function|class|type|interface)\s+([A-Za-z0-9_]+)/g;
      let m: RegExpExecArray | null;
      while ((m = localDecl.exec(content)) !== null) collected.add(m[1]);
      const defaultNamedFn = /export\s+default\s+function\s+([A-Za-z0-9_]+)/g;
      while ((m = defaultNamedFn.exec(content)) !== null) collected.add(m[1]);
      const defaultNamedClass = /export\s+default\s+class\s+([A-Za-z0-9_]+)/g;
      while ((m = defaultNamedClass.exec(content)) !== null)
        collected.add(m[1]);

      const reExportNames =
        /export\s*\{\s*([^}]+)\s*\}\s*(?:from\s*['"]([^'"]+)['"])?/g;
      while ((m = reExportNames.exec(content)) !== null) {
        const list = m[1];
        const fromPath = m[2];
        const names = list
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        names.forEach((n) => {
          const parts = n.split(/\s+as\s+/i).map((s) => s.trim());
          const exportedName = parts[1] || parts[0];
          collected.add(exportedName);
        });
        if (fromPath) {
          const resolved = resolveTarget(filePath, fromPath);
          if (resolved) collectExports(resolved, depth + 1, collected);
        }
      }

      const reExportAll = /export\s*\*\s*from\s*['"]([^'"]+)['"]/g;
      while ((m = reExportAll.exec(content)) !== null) {
        const fromPath = m[1];
        const resolved = resolveTarget(filePath, fromPath);
        if (resolved) collectExports(resolved, depth + 1, collected);
      }

      return collected;
    }

    const exported = collectExports(indexPath);

    const required = [
      "PromptInput",
      "PromptInputTextarea",
      "PromptInputActions",
      "PromptInputAction",
      "ChatContainerRoot",
      "ChatContainerContent",
      "ChatContainerScrollAnchor",
      "Tooltip",
      "TooltipTrigger",
      "TooltipContent",
      "TooltipProvider",
      "Textarea",
      "Todo",
    ];

    const missing = required.filter((n) => !exported.has(n));
    if (missing.length > 0) {
      throw new Error(
        `packages/ui/src/index.ts must export: ${required.join(", ")}; missing: ${missing.join(", ")}`,
      );
    }
  });

  it("vite configs expose alias @pidesk/ui (to be added in green stage)", () => {
    const webVite = path.join(ROOT, "apps/web/vite.config.ts");
    const desktopVite = path.join(ROOT, "apps/desktop/electron.vite.config.ts");
    const webContent = read(webVite);
    const desktopContent = read(desktopVite);
    if (webContent === null) throw new Error(`Missing ${webVite}`);
    if (desktopContent === null) throw new Error(`Missing ${desktopVite}`);
    if (!webContent.includes("@pidesk/ui"))
      throw new Error(`${webVite} must expose an alias for @pidesk/ui`);
    if (!desktopContent.includes("@pidesk/ui"))
      throw new Error(`${desktopVite} must expose an alias for @pidesk/ui`);
  });
});
