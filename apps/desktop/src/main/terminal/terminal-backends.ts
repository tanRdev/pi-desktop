import type { TerminalBackend } from "@pidesk/shared";

export interface ResolveLocalShellProgramOptions {
  platform: NodeJS.Platform;
  shell?: string | undefined;
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
