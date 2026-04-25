import { fileURLToPath } from "node:url";

import {
  measureFileSize,
  readBudgetBytes,
  runBudgetChecks,
} from "./perf-budget-helpers.mjs";

const startupChecks = [
  {
    label: "main/index.js",
    maxBytes: readBudgetBytes("PI_PERF_STARTUP_MAIN_MAX_BYTES", 1_572_864),
    measure: (rootDir) =>
      measureFileSize(rootDir, "apps/desktop/out/main/index.js"),
  },
  {
    label: "preload/index.cjs",
    maxBytes: readBudgetBytes("PI_PERF_STARTUP_PRELOAD_MAX_BYTES", 196_608),
    measure: (rootDir) =>
      measureFileSize(rootDir, "apps/desktop/out/preload/index.cjs"),
  },
  {
    label: "renderer/index.html",
    maxBytes: readBudgetBytes("PI_PERF_STARTUP_RENDERER_HTML_MAX_BYTES", 8_192),
    measure: (rootDir) =>
      measureFileSize(rootDir, "apps/desktop/out/renderer/index.html"),
  },
];

export function runStartupBudgetCheck(rootDir) {
  return runBudgetChecks("Startup", startupChecks, rootDir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runStartupBudgetCheck();
}
