import type { TerminalBackend } from "@pidesk/shared";
import { createTmuxThreadSessionName } from "../tmux-session-naming";

export type TmuxLaunchBackend = Extract<
  TerminalBackend,
  "shell" | "lazygit" | "tmux-attach"
>;

const tmuxLaunchBackends = new Set<TmuxLaunchBackend>([
  "shell",
  "lazygit",
  "tmux-attach",
]);

export interface ResolveLocalShellProgramOptions {
  platform: NodeJS.Platform;
  shell?: string | undefined;
}

export interface BuildTmuxLaunchSpecOptions {
  id: string;
  backend: TmuxLaunchBackend;
  cwd: string;
  linkedThreadId?: string | undefined;
  platform: NodeJS.Platform;
  shell?: string | undefined;
  tmuxBinary?: string | undefined;
}

export function isTmuxLaunchBackend(
  backend: TerminalBackend,
): backend is TmuxLaunchBackend {
  return tmuxLaunchBackends.has(backend as TmuxLaunchBackend);
}

export interface TmuxLaunchSpec {
  tmuxSessionName: string;
  createArgs: string[];
  attachCommand: {
    program: string;
    args: string[];
  };
}

function sanitizeSessionName(id: string): string {
  const sanitized = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `pidesk-term-${sanitized}`.slice(0, 48);
}

export function resolveLocalShellProgram({
  platform,
  shell,
}: ResolveLocalShellProgramOptions): string {
  if (platform === "win32") {
    return "powershell.exe";
  }

  return shell || "/bin/zsh";
}

export function buildTmuxLaunchSpec({
  id,
  backend,
  cwd,
  linkedThreadId,
  platform,
  shell,
  tmuxBinary = "tmux",
}: BuildTmuxLaunchSpecOptions): TmuxLaunchSpec {
  const tmuxSessionName = sanitizeSessionName(id);
  const createArgs = ["new-session", "-d", "-s", tmuxSessionName, "-c", cwd];

  if (backend === "lazygit") {
    createArgs.push("lazygit");
  } else if (backend === "tmux-attach") {
    if (!linkedThreadId) {
      throw new Error("tmux-attach backend requires linkedThreadId");
    }

    createArgs.push(
      "tmux",
      "attach",
      "-t",
      createTmuxThreadSessionName(linkedThreadId),
    );
  } else {
    createArgs.push(
      resolveLocalShellProgram({
        platform,
        shell,
      }),
    );
  }

  return {
    tmuxSessionName,
    createArgs,
    attachCommand: {
      program: tmuxBinary,
      args: ["attach", "-t", tmuxSessionName],
    },
  };
}
