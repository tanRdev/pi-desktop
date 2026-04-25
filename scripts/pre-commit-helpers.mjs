import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const biomeFilePattern = /\.(?:[cm]?[jt]sx?|jsonc?|md|mdx)$/iu;
const documentationFilePattern =
  /(?:^|\/)(?:README|CHANGELOG|CONTRIBUTING)(?:\.[^.]+)?$/iu;
const documentationExtensionPattern = /\.(?:md|mdx|txt)$/iu;

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function dedupe(values) {
  return [...new Set(values)];
}

function isDocumentationFile(filePath) {
  return (
    documentationFilePattern.test(filePath) ||
    documentationExtensionPattern.test(filePath)
  );
}

function shouldRunBiomeOnFile(filePath) {
  return biomeFilePattern.test(filePath);
}

function findOwningWorkspace(filePath, workspaces) {
  return (
    workspaces.find(
      (workspace) =>
        filePath === workspace.dir || filePath.startsWith(`${workspace.dir}/`),
    ) ?? null
  );
}

function collectDependentWorkspaceNames(targetNames, workspaces) {
  const reverseDependencies = new Map();

  for (const workspace of workspaces) {
    for (const dependency of workspace.dependencies) {
      const dependents = reverseDependencies.get(dependency) ?? [];
      dependents.push(workspace.name);
      reverseDependencies.set(dependency, dependents);
    }
  }

  const visited = new Set(targetNames);
  const queue = [...targetNames];

  while (queue.length > 0) {
    const workspaceName = queue.shift();
    const dependents = reverseDependencies.get(workspaceName) ?? [];

    for (const dependentName of dependents) {
      if (visited.has(dependentName)) {
        continue;
      }

      visited.add(dependentName);
      queue.push(dependentName);
    }
  }

  return [...visited].sort((left, right) => left.localeCompare(right));
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readWorkspaceDirectories(rootDir, workspacePattern) {
  if (!workspacePattern.endsWith("/*")) {
    return [];
  }

  const relativeRoot = workspacePattern.slice(0, -2);
  const absoluteRoot = path.join(rootDir, relativeRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  return readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${relativeRoot}/${entry.name}`)
    .sort((left, right) => left.localeCompare(right));
}

export function loadWorkspaceMetadata(rootDir) {
  const rootPackageJson = readJsonFile(path.join(rootDir, "package.json"));
  const workspacePatterns = Array.isArray(rootPackageJson.workspaces)
    ? rootPackageJson.workspaces
    : [];
  const workspaceDirs = dedupe(
    workspacePatterns.flatMap((workspacePattern) =>
      readWorkspaceDirectories(rootDir, workspacePattern),
    ),
  );
  const packageNames = new Set();
  const rawWorkspaces = [];

  for (const workspaceDir of workspaceDirs) {
    const packageJsonPath = path.join(rootDir, workspaceDir, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = readJsonFile(packageJsonPath);
    if (typeof packageJson.name !== "string") {
      continue;
    }

    packageNames.add(packageJson.name);
    rawWorkspaces.push({
      dir: normalizePath(workspaceDir),
      name: packageJson.name,
      packageJson,
    });
  }

  return rawWorkspaces
    .map((workspace) => ({
      dir: workspace.dir,
      name: workspace.name,
      dependencies: [
        ...Object.keys(workspace.packageJson.dependencies ?? {}),
        ...Object.keys(workspace.packageJson.devDependencies ?? {}),
        ...Object.keys(workspace.packageJson.peerDependencies ?? {}),
        ...Object.keys(workspace.packageJson.optionalDependencies ?? {}),
      ]
        .filter((dependencyName) => packageNames.has(dependencyName))
        .sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createPreCommitPlan({ stagedFiles, workspaces }) {
  const normalizedFiles = dedupe(
    stagedFiles.map((filePath) => normalizePath(filePath)).filter(Boolean),
  );
  const biomeFiles = normalizedFiles.filter(shouldRunBiomeOnFile);
  const workspaceTargets = new Set();
  let requiresRootTypecheck = false;

  for (const filePath of normalizedFiles) {
    if (isDocumentationFile(filePath)) {
      continue;
    }

    const owningWorkspace = findOwningWorkspace(filePath, workspaces);
    if (owningWorkspace === null) {
      requiresRootTypecheck = true;
      continue;
    }

    workspaceTargets.add(owningWorkspace.name);
  }

  if (requiresRootTypecheck) {
    return {
      biomeFiles,
      typecheck: {
        strategy: "root",
        workspaceNames: [],
      },
    };
  }

  if (workspaceTargets.size === 0) {
    return {
      biomeFiles,
      typecheck: {
        strategy: "none",
        workspaceNames: [],
      },
    };
  }

  return {
    biomeFiles,
    typecheck: {
      strategy: "workspace",
      workspaceNames: collectDependentWorkspaceNames(
        [...workspaceTargets],
        workspaces,
      ),
    },
  };
}

export function formatCommand(command, args) {
  return [command, ...args].join(" ");
}
