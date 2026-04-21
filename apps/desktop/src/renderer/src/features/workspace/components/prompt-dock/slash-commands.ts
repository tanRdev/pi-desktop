import type { SlashSuggestion } from "@pi-desktop/shared";

/**
 * Built-in slash command registry.
 *
 * When selected, these commands dispatch a `pi:command` CustomEvent on
 * `window` so other code (keyboard shortcuts, settings host, etc.) can react
 * without a direct import.
 *
 * If a target action is not yet wired, these act as stubs — the event fires
 * regardless.
 */
export interface BuiltInSlashCommand {
  readonly slash: string;
  readonly name: string;
  readonly description: string;
  /** Stable id dispatched via `pi:command`. */
  readonly commandId: string;
}

export const BUILT_IN_SLASH_COMMANDS: readonly BuiltInSlashCommand[] = [
  {
    slash: "/help",
    name: "help",
    description: "Show help / available commands",
    commandId: "help",
  },
  {
    slash: "/clear",
    name: "clear",
    description: "Clear the current thread",
    commandId: "clear",
  },
  {
    slash: "/model",
    name: "model",
    description: "Open the model picker",
    commandId: "model",
  },
  {
    slash: "/new",
    name: "new",
    description: "Start a new thread",
    commandId: "new",
  },
  {
    slash: "/settings",
    name: "settings",
    description: "Open the settings panel",
    commandId: "settings",
  },
];

export interface PiCommandEventDetail {
  commandId: string;
  /** Original slash text that triggered the command, if any. */
  slash?: string;
}

/**
 * Dispatch a `pi:command` CustomEvent for the given built-in command.
 */
export function dispatchPiCommand(command: BuiltInSlashCommand): void {
  if (typeof window === "undefined") return;
  const detail: PiCommandEventDetail = {
    commandId: command.commandId,
    slash: command.slash,
  };
  window.dispatchEvent(new CustomEvent("pi:command", { detail }));
}

/**
 * Convert built-ins into `SlashSuggestion` items so they render in the
 * existing autocomplete dropdown.
 */
export function builtInSlashSuggestions(query: string): SlashSuggestion[] {
  const normalized = query.trim().toLowerCase();
  return BUILT_IN_SLASH_COMMANDS.filter((cmd) => {
    if (normalized.length === 0) return true;
    return (
      cmd.name.toLowerCase().startsWith(normalized) ||
      cmd.slash.toLowerCase().startsWith(`/${normalized}`)
    );
  }).map((cmd) => ({
    kind: "command",
    name: cmd.name,
    slash: cmd.slash,
    description: cmd.description,
    source: "builtin",
  }));
}

/**
 * Find the built-in command matching a slash suggestion (by slash text).
 */
export function findBuiltInBySlash(
  slash: string,
): BuiltInSlashCommand | undefined {
  return BUILT_IN_SLASH_COMMANDS.find((cmd) => cmd.slash === slash);
}
