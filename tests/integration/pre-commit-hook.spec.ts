import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

type WorkspaceFixture = {
  name: string;
  dir: string;
  dependencies: string[];
};

const fixtureWorkspaces: WorkspaceFixture[] = [
  {
    name: "@pi-desktop/desktop",
    dir: "apps/desktop",
    dependencies: [
      "@pi-desktop/agent-host",
      "@pi-desktop/contracts",
      "@pi-desktop/shared",
      "@pi-desktop/shell-model",
      "@pi-desktop/ui",
    ],
  },
  {
    name: "@pi-desktop/agent-host",
    dir: "packages/agent-host",
    dependencies: ["@pi-desktop/shared"],
  },
  {
    name: "@pi-desktop/contracts",
    dir: "packages/contracts",
    dependencies: ["@pi-desktop/shared"],
  },
  {
    name: "@pi-desktop/shared",
    dir: "packages/shared",
    dependencies: [],
  },
  {
    name: "@pi-desktop/shell-model",
    dir: "packages/shell-model",
    dependencies: ["@pi-desktop/shared"],
  },
  {
    name: "@pi-desktop/ui",
    dir: "packages/ui",
    dependencies: [],
  },
];

describe("pre-commit helpers", () => {
  it("expands typecheck targets to dependent workspaces", async () => {
    const { createPreCommitPlan } = await import(
      "../../scripts/pre-commit-helpers.mjs"
    );

    const plan = createPreCommitPlan({
      stagedFiles: ["packages/shared/src/index.ts"],
      workspaces: fixtureWorkspaces,
    });

    expect(plan.biomeFiles).toEqual(["packages/shared/src/index.ts"]);
    expect(plan.typecheck).toEqual({
      strategy: "workspace",
      workspaceNames: [
        "@pi-desktop/agent-host",
        "@pi-desktop/contracts",
        "@pi-desktop/desktop",
        "@pi-desktop/shared",
        "@pi-desktop/shell-model",
      ],
    });
  });

  it("falls back to root typecheck for root-level tooling changes", async () => {
    const { createPreCommitPlan } = await import(
      "../../scripts/pre-commit-helpers.mjs"
    );

    const plan = createPreCommitPlan({
      stagedFiles: ["package.json", "packages/ui/src/index.ts"],
      workspaces: fixtureWorkspaces,
    });

    expect(plan.biomeFiles).toEqual([
      "package.json",
      "packages/ui/src/index.ts",
    ]);
    expect(plan.typecheck).toEqual({
      strategy: "root",
      workspaceNames: [],
    });
  });

  it("skips typecheck when only documentation files are staged", async () => {
    const { createPreCommitPlan } = await import(
      "../../scripts/pre-commit-helpers.mjs"
    );

    const plan = createPreCommitPlan({
      stagedFiles: ["README.md"],
      workspaces: fixtureWorkspaces,
    });

    expect(plan.biomeFiles).toEqual(["README.md"]);
    expect(plan.typecheck).toEqual({
      strategy: "none",
      workspaceNames: [],
    });
  });
});

describe("pre-commit script", () => {
  it("supports a dry-run with simulated staged files", () => {
    const scriptPath = path.join(process.cwd(), "scripts", "pre-commit.mjs");
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PI_PRECOMMIT_DRY_RUN: "1",
        PI_PRECOMMIT_STAGED_FILES: "packages/ui/src/index.ts",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Dry run");
    expect(result.stdout).toContain("biome check --write");
    expect(result.stdout).toContain("@pi-desktop/ui");
  });
});
