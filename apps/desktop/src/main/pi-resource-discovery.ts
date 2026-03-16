import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  AutocompleteContext,
  AutocompleteSuggestions,
  PiCommandInfo,
  PiDiscoveryResult,
  PiSkillInfo,
  SlashSuggestion,
} from "@pidesk/shared";

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

function createCommandInfo(commandFile: string): PiCommandInfo {
  return {
    name: path.basename(commandFile, path.extname(commandFile)),
    description: readMarkdownDescription(commandFile),
    source: commandFile,
  };
}

function listCommands(agentDir: string, cwd: string): PiCommandInfo[] {
  const commandRoots = [
    path.join(agentDir, "commands"),
    path.join(agentDir, "extensions"),
    path.join(cwd, ".claude", "commands"),
  ];

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
): PiDiscoveryResult {
  const isInstalled = existsSync(agentDir);
  const skills = isInstalled ? listSkills(agentDir) : [];
  const commands = isInstalled ? listCommands(agentDir, cwd) : [];

  return {
    isInstalled,
    globalAgentDir: isInstalled ? agentDir : undefined,
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
  maxResults?: number;
}): AutocompleteSuggestions {
  const { agentDir, cwd, context, maxResults = 12 } = options;
  const discovery = discoverPiResources(agentDir, cwd);
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
  ].slice(0, maxResults);

  return {
    kind: "slash",
    suggestions,
    hasMore: suggestions.length >= maxResults,
  };
}
