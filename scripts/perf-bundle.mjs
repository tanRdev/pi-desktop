import { fileURLToPath } from "node:url";

import {
  measureDirectorySize,
  readBudgetBytes,
  runBudgetChecks,
} from "./perf-budget-helpers.mjs";

const bundleChecks = [
  {
    label: "main",
    maxBytes: readBudgetBytes("PI_PERF_BUNDLE_MAIN_MAX_BYTES", 25_165_824),
    measure: (rootDir) =>
      measureDirectorySize(rootDir, "apps/desktop/out/main"),
  },
  {
    label: "preload",
    maxBytes: readBudgetBytes("PI_PERF_BUNDLE_PRELOAD_MAX_BYTES", 262_144),
    measure: (rootDir) =>
      measureDirectorySize(rootDir, "apps/desktop/out/preload"),
  },
  {
    label: "renderer",
    maxBytes: readBudgetBytes("PI_PERF_BUNDLE_RENDERER_MAX_BYTES", 41_943_040),
    measure: (rootDir) =>
      measureDirectorySize(rootDir, "apps/desktop/out/renderer"),
  },
];

export function runBundleBudgetCheck(rootDir) {
  return runBudgetChecks("Bundle", bundleChecks, rootDir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runBundleBudgetCheck();
}
