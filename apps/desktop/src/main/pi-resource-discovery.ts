import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  AutocompleteContext,
  AutocompleteSuggestions,
  PiCommandInfo,
  PiDiscoveryResult,
  PiSkillInfo,
  SlashSuggestion,
} from "@pi-desktop/shared";

const BUILT_IN_COMMANDS: PiCommandInfo[] = [
  {
    name: "login",
    description: "Authenticate with an OAuth provider",
    source: "builtin",
  },
  {
    name: "logout",
    description: "Clear saved OAuth credentials for a provider",
    source: "builtin",
  },
  {
    name: "providers",
    description: "List available OAuth providers and auth status",
    source: "builtin",
  },
];

const BUILT_IN_COMMAND_ALIASES: Record<string, string[]> = {
  login: ["auth", "oauth", "signin", "sign-in"],
  logout: ["signout", "sign-out"],
  providers: ["provider", "models", "oauth"],
};

function readMarkdownDescription(filePath: string): string | undefined {
  try {
    const content = readFileSync(filePath, "utf8");
    const frontmatterMatch = content.match(
      /^---\n[\s\S]*?^description:\s*"?(.+?)"?\s*$[\s\S]*?^---/m,
    );
    if (frontmatterMatch?.[1]) {
      return frontmatterMatch[1].trim();
    }

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith("#"))
      .filter((line) => !line.startsWith("---"));

    return lines[0];
  } catch {
    return undefined;
  }
}

function listDirectories(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  return readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dirPath, entry.name));
}

function walkMarkdownFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  const results: string[] = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(nextPath);
      }
    }
  }

  return results;
}

function createSkillInfo(skillDir: string): PiSkillInfo {
  const name = path.basename(skillDir);
  const skillFile = path.join(skillDir, "SKILL.md");

  return {
    name,
    description: existsSync(skillFile)
      ? readMarkdownDescription(skillFile)
      : undefined,
    source: skillFile,
  };
}

function listSkills(agentDir: string): PiSkillInfo[] {
  const skillsDir = path.join(agentDir, "skills");

  return listDirectories(skillsDir)
    .map(createSkillInfo)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}

type PiDiscoveryOptions = {
  homeDir?: string;
  includeMachineAgentRoots?: boolean;
};

function getSkillRoots(
  agentDir: string,
  cwd: string,
  homeDir: string,
  includeMachineAgentRoots: boolean,
): string[] {
  if (!includeMachineAgentRoots) {
    return uniquePaths([agentDir, path.join(cwd, ".pi", "agent")]);
  }

  return uniquePaths([
    agentDir,
    path.join(cwd, ".pi", "agent"),
    path.join(homeDir, ".pi", "agent"),
    path.join(homeDir, ".agents"),
    path.join(homeDir, ".opencode"),
    path.join(homeDir, ".claude"),
    path.join(homeDir, ".cursor"),
    path.join(homeDir, ".aider"),
  ]);
}

function listMergedSkills(skillRoots: readonly string[]): PiSkillInfo[] {
  const merged = new Map<string, PiSkillInfo>();

  for (const root of skillRoots) {
    for (const skill of listSkills(root)) {
      merged.set(skill.name, skill);
    }
  }

  return [...merged.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function createCommandInfo(commandFile: string): PiCommandInfo {
  return {
    name: path.basename(commandFile, path.extname(commandFile)),
    description: readMarkdownDescription(commandFile),
    source: commandFile,
  };
}

function getCommandRoots(
  agentDir: string,
  cwd: string,
  homeDir: string,
  includeMachineAgentRoots: boolean,
): string[] {
  if (!includeMachineAgentRoots) {
    return uniquePaths([
      path.join(agentDir, "commands"),
      path.join(agentDir, "extensions"),
      path.join(cwd, ".pi", "agent", "commands"),
      path.join(cwd, ".pi", "agent", "extensions"),
      path.join(cwd, ".claude", "commands"),
    ]);
  }

  return uniquePaths([
    path.join(agentDir, "commands"),
    path.join(agentDir, "extensions"),
    path.join(cwd, ".pi", "agent", "commands"),
    path.join(cwd, ".pi", "agent", "extensions"),
    path.join(homeDir, ".pi", "agent", "commands"),
    path.join(homeDir, ".pi", "agent", "extensions"),
    path.join(cwd, ".claude", "commands"),
    path.join(homeDir, ".claude", "commands"),
  ]);
}

function listCommands(commandRoots: readonly string[]): PiCommandInfo[] {
  const commands = new Map<string, PiCommandInfo>();

  for (const root of commandRoots) {
    for (const filePath of walkMarkdownFiles(root)) {
      if (
        !filePath.includes(`${path.sep}commands${path.sep}`) &&
        !root.endsWith(`${path.sep}commands`)
      ) {
        continue;
      }

      const info = createCommandInfo(filePath);
      const key = `${info.name}:${info.source}`;
      commands.set(key, info);
    }
  }

  return [...commands.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function discoverPiResources(
  agentDir: string,
  cwd: string,
  options?: PiDiscoveryOptions,
): PiDiscoveryResult {
  const homeDir = options?.homeDir ?? os.homedir();
  const includeMachineAgentRoots = options?.includeMachineAgentRoots ?? false;
  const projectAgentDir = path.join(cwd, ".pi", "agent");
  const homeAgentDir = path.join(homeDir, ".pi", "agent");
  const skillRoots = getSkillRoots(
    agentDir,
    cwd,
    homeDir,
    includeMachineAgentRoots,
  );
  const commandRoots = getCommandRoots(
    agentDir,
    cwd,
    homeDir,
    includeMachineAgentRoots,
  );
  const isInstalled =
    existsSync(agentDir) ||
    existsSync(projectAgentDir) ||
    skillRoots.some((root) => existsSync(root)) ||
    commandRoots.some((root) => existsSync(root));
  const skills = listMergedSkills(skillRoots);
  const commands = listCommands(commandRoots);

  return {
    isInstalled,
    globalAgentDir: existsSync(homeAgentDir)
      ? homeAgentDir
      : existsSync(agentDir)
        ? agentDir
        : undefined,
    skills,
    commands,
  };
}

function matchesQuery(
  name: string,
  description: string | undefined,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return (
    name.toLowerCase().includes(normalizedQuery) ||
    description?.toLowerCase().includes(normalizedQuery) === true
  );
}

function matchesBuiltInCommand(command: PiCommandInfo, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [command.name, ...(BUILT_IN_COMMAND_ALIASES[command.name] ?? [])].some(
    (value) => value.includes(normalizedQuery),
  );
}

function toSkillSuggestion(skill: PiSkillInfo): SlashSuggestion {
  return {
    kind: "skill",
    name: skill.name,
    slash: `/skill:${skill.name}`,
    description: skill.description,
    source: skill.source,
  };
}

function toCommandSuggestion(command: PiCommandInfo): SlashSuggestion {
  return {
    kind: "command",
    name: command.name,
    slash: `/${command.name}`,
    description: command.description,
    source: command.source,
  };
}

export function getPiSlashSuggestions(options: {
  agentDir: string;
  cwd: string;
  context: AutocompleteContext;
  discoveryOptions?: PiDiscoveryOptions;
}): AutocompleteSuggestions {
  const { agentDir, cwd, context, discoveryOptions } = options;
  const discovery = discoverPiResources(agentDir, cwd, {
    includeMachineAgentRoots: true,
    ...discoveryOptions,
  });
  const query = context.query.trim();

  const suggestions = [
    ...discovery.skills
      .filter((skill) => matchesQuery(skill.name, skill.description, query))
      .map(toSkillSuggestion),
    ...discovery.commands
      .filter((command) =>
        matchesQuery(command.name, command.description, query),
      )
      .map(toCommandSuggestion),
    ...BUILT_IN_COMMANDS.filter((command) =>
      matchesBuiltInCommand(command, query),
    ).map(toCommandSuggestion),
  ];

  return {
    kind: "slash",
    suggestions,
    hasMore: false,
  };
}
