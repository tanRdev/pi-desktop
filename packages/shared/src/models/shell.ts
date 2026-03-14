export type AppRuntimeMode = "development" | "production" | "test";

export type ShellAgentMode = "mock" | "sdk" | "unknown";

export interface ShellRuntimeSnapshot {
  agentMode: ShellAgentMode;
  electronVersion?: string;
}

export interface ShellProjectSnapshot {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
}

export interface ShellWorkspaceSnapshot {
  rootPath: string;
  agentDirectory: string | null;
  projects: ShellProjectSnapshot[];
}

export interface ShellCapabilitiesSnapshot {
  supportsTurns: boolean;
  supportsTools: boolean;
  supportsActivity: boolean;
  supportsParallelSessions: boolean;
}

export interface ShellSnapshot {
  appName: string;
  appVersion: string;
  platform: NodeJS.Platform | string;
  chromeVersion: string;
  mode: AppRuntimeMode;
  runtime?: ShellRuntimeSnapshot;
  workspace?: ShellWorkspaceSnapshot;
  capabilities?: ShellCapabilitiesSnapshot;
  // Optional git information about the current workspace. Keep lightweight and
  // forward-compatible so renderer slices can handle missing fields.
  git?: ShellGitSnapshot;
}

export type ShellGitStatus = "repository" | "not_repo" | "unavailable";

export interface ShellGitSnapshot {
  // Overall state of git for the current workspace
  status: ShellGitStatus;

  // The repository root path when status === 'repository'
  rootPath?: string;

  // Current branch name (or 'HEAD' for detached)
  branch?: string;

  // Short commit SHA (e.g. 7 chars) for HEAD
  commit?: string;

  // Lightweight working-tree summary
  hasChanges?: boolean;
  ahead?: number; // commits ahead of upstream
  behind?: number; // commits behind upstream
  stagedCount?: number;
  modifiedCount?: number;
  untrackedCount?: number;

  // Optional human-friendly message when unavailable or errors occur
  message?: string | null;
}
