import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  InstalledPackageSnapshot,
  PackageCatalogDetail,
  PackageInstallRequest,
  PackageInstallScope,
  PackageManagerStatus,
  PackageOperationSnapshot,
  PackageRemoveRequest,
  PackageSearchRequest,
  PackageSearchResponse,
  PackagesEvent,
  PackageUpdateRequest,
} from "@pidesk/shared";
import { PackageOperationQueue } from "./package-operation-queue";
import { PackagesCatalogClient } from "./packages-catalog-client";
import { PackagesCli } from "./packages-cli";
import type { PackagesService } from "./packages-service";

type PackagesSettings = {
  packages?: string[];
};

export interface PackagesServiceDependencies {
  homePath: string;
  getLocalSettingsPath: () => string | null;
  getLocalWorkingDirectory: () => string | null;
  emit(event: PackagesEvent): void;
  cli?: {
    run(
      args: string[],
      cwd: string,
    ): Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
    }>;
  };
  catalogClient?: {
    search(request: PackageSearchRequest): Promise<PackageSearchResponse>;
    getDetail(packageName: string): Promise<PackageCatalogDetail>;
  };
}

function safeReadSettings(settingsPath: string | null): PackagesSettings {
  if (!settingsPath) {
    return {};
  }

  try {
    const content = readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(content) as PackagesSettings;
    return parsed;
  } catch {
    return {};
  }
}

function normalizeListOutput(
  stdout: string,
): Array<{ source: string; installPath: string | null }> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const entries: Array<{ source: string; installPath: string | null }> = [];
  let pendingSource: string | null = null;

  for (const line of lines) {
    if (line === "User packages:" || line === "Project packages:") {
      pendingSource = null;
      continue;
    }

    if (
      line.startsWith("npm:") ||
      line.startsWith("git:") ||
      line.startsWith("http") ||
      line.startsWith("ssh://") ||
      line.startsWith("./")
    ) {
      pendingSource = line;
      entries.push({ source: line, installPath: null });
      continue;
    }

    if (pendingSource && line.startsWith("/")) {
      const entry = entries.find(
        (candidate) =>
          candidate.source === pendingSource && candidate.installPath === null,
      );
      if (entry) {
        entry.installPath = line;
      }
      pendingSource = null;
    }
  }

  return entries;
}

function extractPackageName(source: string): string {
  if (source.startsWith("npm:")) {
    return source.slice(4);
  }

  return source;
}

export class PackagesServiceImpl implements PackagesService {
  private readonly catalogClient: {
    search(request: PackageSearchRequest): Promise<PackageSearchResponse>;
    getDetail(packageName: string): Promise<PackageCatalogDetail>;
  };
  private readonly cli: {
    run(
      args: string[],
      cwd: string,
    ): Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
    }>;
  };
  private readonly operationQueue = new PackageOperationQueue();
  private readonly listeners = new Set<(event: PackagesEvent) => void>();

  constructor(private readonly dependencies: PackagesServiceDependencies) {
    this.catalogClient =
      dependencies.catalogClient ?? new PackagesCatalogClient();
    this.cli = dependencies.cli ?? new PackagesCli();
  }

  async getManagerStatus(): Promise<PackageManagerStatus> {
    try {
      await this.cli.run(["--help"], this.dependencies.homePath);
      return {
        cli: "available",
        network: "available",
        authenticated: true,
        message: null,
      };
    } catch (error) {
      return {
        cli: "unavailable",
        network: "available",
        authenticated: false,
        message: error instanceof Error ? error.message : "Pi CLI unavailable",
      };
    }
  }

  searchCatalog(request: PackageSearchRequest): Promise<PackageSearchResponse> {
    return this.catalogClient.search(request);
  }

  getPackageDetail(packageName: string) {
    return this.catalogClient.getDetail(packageName);
  }

  async listInstalled(
    scope?: PackageInstallScope,
  ): Promise<InstalledPackageSnapshot[]> {
    const cwd =
      this.dependencies.getLocalWorkingDirectory() ??
      this.dependencies.homePath;
    const listResult = await this.cli.run(["list"], cwd);
    const listedEntries = normalizeListOutput(listResult.stdout);
    const globalSettings = safeReadSettings(
      path.join(this.dependencies.homePath, ".pi", "agent", "settings.json"),
    );
    const localSettings = safeReadSettings(
      this.dependencies.getLocalSettingsPath(),
    );
    const globalPackages = new Set(globalSettings.packages ?? []);
    const localPackages = new Set(localSettings.packages ?? []);

    const installed = listedEntries.map((entry) => {
      const packageName = extractPackageName(entry.source);
      let inferredScope: PackageInstallScope = "global";
      if (localPackages.has(entry.source)) {
        inferredScope = "local";
      } else if (globalPackages.has(entry.source)) {
        inferredScope = "global";
      }

      return {
        source: entry.source,
        name: packageName,
        version: null,
        scope: inferredScope,
        installPath: entry.installPath,
        isPinned:
          entry.source.includes("@") && !entry.source.startsWith("npm:@"),
      } satisfies InstalledPackageSnapshot;
    });

    if (!scope) {
      return installed;
    }

    return installed.filter((entry) => entry.scope === scope);
  }

  async install(
    request: PackageInstallRequest,
  ): Promise<PackageOperationSnapshot> {
    return this.runMutation("install", request.packageName, request.scope, [
      "install",
      ...(request.scope === "local" ? ["-l"] : []),
      `npm:${request.packageName}`,
    ]);
  }

  async remove(
    request: PackageRemoveRequest,
  ): Promise<PackageOperationSnapshot> {
    return this.runMutation("remove", request.packageName, request.scope, [
      "remove",
      ...(request.scope === "local" ? ["-l"] : []),
      `npm:${request.packageName}`,
    ]);
  }

  async update(
    request: PackageUpdateRequest,
  ): Promise<PackageOperationSnapshot> {
    return this.runMutation(
      "update",
      request.packageName ?? "all-packages",
      request.scope,
      [
        "update",
        ...(request.packageName ? [`npm:${request.packageName}`] : []),
      ],
    );
  }

  subscribe(listener: (event: PackagesEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: PackagesEvent) {
    this.dependencies.emit(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async runMutation(
    kind: PackageOperationSnapshot["kind"],
    packageName: string,
    scope: PackageInstallScope,
    args: string[],
  ): Promise<PackageOperationSnapshot> {
    let snapshot = this.operationQueue.create(
      packageName,
      scope,
      kind,
      "queued",
      `${kind} queued`,
    );
    this.emit({ type: "operation_updated", operation: snapshot });

    snapshot = this.operationQueue.update(
      snapshot,
      "running",
      `${kind} in progress`,
    );
    this.emit({ type: "operation_updated", operation: snapshot });

    const localWorkingDirectory = this.dependencies.getLocalWorkingDirectory();
    if (scope === "local" && !localWorkingDirectory) {
      snapshot = this.operationQueue.update(
        snapshot,
        "failed",
        "Local installs require an active worktree",
      );
      this.emit({ type: "operation_updated", operation: snapshot });
      return snapshot;
    }

    const cwd =
      scope === "local"
        ? (localWorkingDirectory ?? this.dependencies.homePath)
        : this.dependencies.homePath;
    const result = await this.cli.run(args, cwd);
    const output = [result.stdout, result.stderr].filter(
      (line) => line.trim().length > 0,
    );

    snapshot = this.operationQueue.update(
      snapshot,
      result.exitCode === 0 ? "succeeded" : "failed",
      result.exitCode === 0 ? `${kind} completed` : `${kind} failed`,
      output,
    );
    this.emit({ type: "operation_updated", operation: snapshot });

    const installed = await this.listInstalled(scope);
    this.emit({
      type: "installed_state_changed",
      scope,
      installed,
    });

    return snapshot;
  }
}
