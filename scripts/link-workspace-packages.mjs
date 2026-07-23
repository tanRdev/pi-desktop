#!/usr/bin/env node
/**
 * Ensure root node_modules/@pi-desktop/* symlinks exist for Vitest/integration
 * resolution when Bun does not hoist workspace packages to the repo root.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const linkRoot = path.join(root, "node_modules", "@pi-desktop");
const packages = ["shared", "contracts", "ui", "shell-model", "agent-host"];

mkdirSync(linkRoot, { recursive: true });

for (const name of packages) {
  const target = path.join(root, "packages", name);
  const linkPath = path.join(linkRoot, name);
  if (!existsSync(target)) continue;
  if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false })) {
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(linkPath);
      } else {
        continue;
      }
    } catch {
      // ignore
    }
  }
  symlinkSync(path.relative(linkRoot, target), linkPath);
  console.log(`linked @pi-desktop/${name}`);
}
