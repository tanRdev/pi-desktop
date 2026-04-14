import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const desktopDir = path.join(repoRoot, "apps", "desktop");
const stageDir = path.join(repoRoot, "dist", "electron-app");
const outDir = path.join(desktopDir, "out");
const nodePtyDir = path.join(desktopDir, "node_modules", "node-pty");

if (!existsSync(outDir)) {
  throw new Error(`Desktop build output not found at ${outDir}`);
}

if (!existsSync(nodePtyDir)) {
  throw new Error(`node-pty not found at ${nodePtyDir}`);
}

rmSync(stageDir, { force: true, recursive: true });
mkdirSync(path.join(stageDir, "node_modules"), { recursive: true });

cpSync(outDir, path.join(stageDir, "out"), { recursive: true });
cpSync(nodePtyDir, path.join(stageDir, "node_modules", "node-pty"), {
  recursive: true,
});

writeFileSync(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(
    {
      name: "@pidesk/desktop-release",
      version: "0.1.0",
      main: "out/main/index.js",
      dependencies: {
        "node-pty": "1.1.0",
      },
    },
    null,
    2,
  )}\n`,
);
