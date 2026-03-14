import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("electron-builder config", () => {
  test("packages desktop output relative to the desktop project directory", () => {
    const configPath = path.resolve(process.cwd(), "electron-builder.yml");
    const config = readFileSync(configPath, "utf8");

    expect(config).toMatch(/\n\s*-\s*out\/\*\*/);
    expect(config).not.toMatch(/apps\/desktop\/out\/\*\*/);
    expect(config).not.toMatch(/packages\/agent-host\/dist\/\*\*/);
  });
});
