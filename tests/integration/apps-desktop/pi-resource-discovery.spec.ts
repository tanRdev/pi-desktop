import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverPiResources,
  getPiSlashSuggestions,
} from "../../../apps/desktop/src/main/pi-resource-discovery";

const tempDirs: string[] = [];

function createTempAgentDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "pidesk-pi-discovery-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("pi-resource-discovery", () => {
  it("discovers skills and commands from the Pi agent directory", () => {
    const agentDir = createTempAgentDir();
    const skillDir = path.join(agentDir, "skills", "brainstorming");
    const commandDir = path.join(agentDir, "commands");

    mkdirSync(skillDir, { recursive: true });
    mkdirSync(commandDir, { recursive: true });

    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      [
        "---",
        'description: "Explore design options"',
        "---",
        "",
        "# Brainstorming",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      path.join(commandDir, "deploy.md"),
      "# Deploy\n\nShip the current app.",
      "utf8",
    );

    const discovery = discoverPiResources(agentDir, agentDir);

    expect(discovery.isInstalled).toBe(true);
    expect(discovery.skills).toEqual([
      {
        name: "brainstorming",
        description: "Explore design options",
        source: path.join(skillDir, "SKILL.md"),
      },
    ]);
    expect(discovery.commands).toEqual([
      {
        name: "deploy",
        description: "Ship the current app.",
        source: path.join(commandDir, "deploy.md"),
      },
    ]);
  });

  it("builds slash suggestions filtered by query", () => {
    const agentDir = createTempAgentDir();
    const skillDir = path.join(agentDir, "skills", "brainstorming");
    const commandDir = path.join(agentDir, "commands");

    mkdirSync(skillDir, { recursive: true });
    mkdirSync(commandDir, { recursive: true });

    writeFileSync(path.join(skillDir, "SKILL.md"), "# Brainstorming", "utf8");
    writeFileSync(path.join(commandDir, "deploy.md"), "# Deploy", "utf8");

    const suggestions = getPiSlashSuggestions({
      agentDir,
      cwd: agentDir,
      discoveryOptions: {
        homeDir: agentDir,
        includeMachineAgentRoots: false,
      },
      context: {
        text: "/dep",
        cursorPosition: 4,
        trigger: "/",
        query: "dep",
      },
    });

    expect(suggestions.kind).toBe("slash");
    expect(suggestions.suggestions).toEqual([
      {
        kind: "command",
        name: "deploy",
        slash: "/deploy",
        description: undefined,
        source: path.join(commandDir, "deploy.md"),
      },
    ]);
  });

  it("merges global and project-local skill discovery without duplicate skill names", () => {
    const globalAgentDir = createTempAgentDir();
    const projectRoot = createTempAgentDir();
    const globalBrainstormingDir = path.join(
      globalAgentDir,
      "skills",
      "brainstorming",
    );
    const globalReviewDir = path.join(globalAgentDir, "skills", "review");
    const projectBrainstormingDir = path.join(
      projectRoot,
      ".pi",
      "agent",
      "skills",
      "brainstorming",
    );
    const projectShipDir = path.join(
      projectRoot,
      ".pi",
      "agent",
      "skills",
      "ship",
    );

    mkdirSync(globalBrainstormingDir, { recursive: true });
    mkdirSync(globalReviewDir, { recursive: true });
    mkdirSync(projectBrainstormingDir, { recursive: true });
    mkdirSync(projectShipDir, { recursive: true });

    writeFileSync(
      path.join(globalBrainstormingDir, "SKILL.md"),
      "# Global brainstorming",
      "utf8",
    );
    writeFileSync(path.join(globalReviewDir, "SKILL.md"), "# Review", "utf8");
    writeFileSync(
      path.join(projectBrainstormingDir, "SKILL.md"),
      "# Project brainstorming",
      "utf8",
    );
    writeFileSync(path.join(projectShipDir, "SKILL.md"), "# Ship", "utf8");

    const discovery = discoverPiResources(globalAgentDir, projectRoot);

    expect(discovery.skills.map((skill) => skill.name)).toEqual([
      "brainstorming",
      "review",
      "ship",
    ]);
    expect(
      discovery.skills.filter((skill) => skill.name === "brainstorming"),
    ).toHaveLength(1);
    expect(
      discovery.skills.find((skill) => skill.name === "brainstorming")?.source,
    ).toBe(path.join(projectBrainstormingDir, "SKILL.md"));
  });

  it("discovers project-local skills even when the global agent dir is missing", () => {
    const missingGlobalAgentDir = path.join(
      os.tmpdir(),
      `pidesk-missing-global-${Date.now()}`,
    );
    const projectRoot = createTempAgentDir();
    const localSkillDir = path.join(
      projectRoot,
      ".pi",
      "agent",
      "skills",
      "local-only",
    );

    mkdirSync(localSkillDir, { recursive: true });
    writeFileSync(path.join(localSkillDir, "SKILL.md"), "# Local only", "utf8");

    const discovery = discoverPiResources(missingGlobalAgentDir, projectRoot);

    expect(discovery.skills).toEqual([
      {
        name: "local-only",
        description: undefined,
        source: path.join(localSkillDir, "SKILL.md"),
      },
    ]);
  });

  it("discovers machine-installed skills from common agent directories", () => {
    const homeDir = createTempAgentDir();
    const projectRoot = createTempAgentDir();
    const threadScopedAgentDir = path.join(
      homeDir,
      ".pi",
      "agent",
      "threads",
      "thread-1",
    );
    const agentsSkillDir = path.join(homeDir, ".agents", "skills", "review");
    const opencodeSkillDir = path.join(
      homeDir,
      ".opencode",
      "skills",
      "expect",
    );
    const claudeSkillDir = path.join(homeDir, ".claude", "skills", "dogfood");

    mkdirSync(threadScopedAgentDir, { recursive: true });
    mkdirSync(agentsSkillDir, { recursive: true });
    mkdirSync(opencodeSkillDir, { recursive: true });
    mkdirSync(claudeSkillDir, { recursive: true });

    writeFileSync(path.join(agentsSkillDir, "SKILL.md"), "# Review", "utf8");
    writeFileSync(path.join(opencodeSkillDir, "SKILL.md"), "# Expect", "utf8");
    writeFileSync(path.join(claudeSkillDir, "SKILL.md"), "# Dogfood", "utf8");

    const discovery = discoverPiResources(threadScopedAgentDir, projectRoot, {
      homeDir,
      includeMachineAgentRoots: true,
    });

    expect(discovery.skills.map((skill) => skill.name)).toEqual([
      "dogfood",
      "expect",
      "review",
    ]);
  });

  it("discovers project-local commands even when the active agent dir is thread-scoped", () => {
    const projectRoot = createTempAgentDir();
    const threadScopedAgentDir = path.join(
      projectRoot,
      ".pi",
      "agent",
      "threads",
      "thread-1",
    );
    const localCommandDir = path.join(projectRoot, ".pi", "agent", "commands");

    mkdirSync(threadScopedAgentDir, { recursive: true });
    mkdirSync(localCommandDir, { recursive: true });
    writeFileSync(
      path.join(localCommandDir, "deploy.md"),
      "# Deploy\n\nShip the current app.",
      "utf8",
    );

    const discovery = discoverPiResources(threadScopedAgentDir, projectRoot);

    expect(discovery.commands).toEqual([
      {
        name: "deploy",
        description: "Ship the current app.",
        source: path.join(localCommandDir, "deploy.md"),
      },
    ]);
  });

  it("discovers globally configured Pi commands even when the active agent dir is thread-scoped", () => {
    const homeDir = createTempAgentDir();
    const projectRoot = createTempAgentDir();
    const threadScopedAgentDir = path.join(
      homeDir,
      ".pi",
      "agent",
      "threads",
      "thread-1",
    );
    const globalCommandDir = path.join(homeDir, ".pi", "agent", "commands");

    mkdirSync(threadScopedAgentDir, { recursive: true });
    mkdirSync(globalCommandDir, { recursive: true });
    writeFileSync(
      path.join(globalCommandDir, "ship.md"),
      "# Ship\n\nShip the current app.",
      "utf8",
    );

    const discovery = discoverPiResources(threadScopedAgentDir, projectRoot, {
      homeDir,
      includeMachineAgentRoots: true,
    });

    expect(discovery.commands).toEqual([
      {
        name: "ship",
        description: "Ship the current app.",
        source: path.join(globalCommandDir, "ship.md"),
      },
    ]);
  });
});
