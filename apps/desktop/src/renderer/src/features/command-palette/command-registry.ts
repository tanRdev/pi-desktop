import * as React from "react";
import { commandHistory } from "./command-history";
import { compareByScore, type FuzzyResult, score } from "./fuzzy";

export type CommandRunContext = {
  /** Whether the user held a modifier while invoking (Cmd/Ctrl). */
  readonly modifier: boolean;
  /** Close the palette after running. Defaults to true if not called. */
  readonly close: () => void;
  /** Keep the palette open. */
  readonly keepOpen: () => void;
};

export type Command = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly shortcut?: string;
  readonly group?: string;
  readonly keywords?: ReadonlyArray<string>;
  readonly icon?: React.ReactNode;
  readonly when?: () => boolean;
  readonly run: (ctx: CommandRunContext) => void | Promise<void>;
};

export type CommandSearchHit = {
  readonly command: Command;
  readonly score: number;
  readonly matchIndices: ReadonlyArray<number>;
};

type Listener = () => void;

class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private readonly listeners = new Set<Listener>();
  private snapshot: ReadonlyArray<Command> = [];

  register(command: Command): () => void {
    this.commands.set(command.id, command);
    this.refreshSnapshot();
    this.emit();
    return () => this.unregister(command.id);
  }

  unregister(id: string): void {
    if (this.commands.delete(id)) {
      this.refreshSnapshot();
      this.emit();
    }
  }

  clear(): void {
    if (this.commands.size === 0) return;
    this.commands.clear();
    this.refreshSnapshot();
    this.emit();
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  list(): ReadonlyArray<Command> {
    return this.snapshot;
  }

  run(commandId: string, ctx: CommandRunContext): void | Promise<void> {
    const command = this.commands.get(commandId);
    if (!command) return;
    commandHistory.recordInvocation(commandId);
    return command.run(ctx);
  }

  getRecentCommandIds(limit = 5): string[] {
    return commandHistory.getRecent(limit);
  }

  getFrequentCommandIds(limit = 5): string[] {
    return commandHistory.getFrequent(limit);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  search(query: string): ReadonlyArray<CommandSearchHit> {
    const visible = this.list().filter((c) => (c.when ? c.when() : true));
    const q = query.trim();

    if (q.length === 0) {
      return visible.map((command) => ({
        command,
        score: 0,
        matchIndices: [],
      }));
    }

    const hits: CommandSearchHit[] = [];
    for (const command of visible) {
      const best = scoreCommand(q, command);
      if (best === null) continue;
      hits.push({
        command,
        score: best.score,
        matchIndices: best.indices,
      });
    }

    hits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return compareByScore(q, a.command.title, b.command.title);
    });
    return hits;
  }

  private refreshSnapshot(): void {
    this.snapshot = Array.from(this.commands.values());
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

function scoreCommand(query: string, command: Command): FuzzyResult | null {
  const titleHit = score(query, command.title);
  let best: FuzzyResult | null = titleHit;

  const tryCandidate = (candidate: string | undefined, penalty: number) => {
    if (!candidate) return;
    const r = score(query, candidate);
    if (!r) return;
    const adjusted: FuzzyResult = { score: r.score - penalty, indices: [] };
    if (!best || adjusted.score > best.score) {
      // Only keep titleHit indices — subtitle/keyword indices don't apply to title rendering.
      best = titleHit ?? adjusted;
      if (!titleHit) best = adjusted;
    }
  };

  tryCandidate(command.subtitle, 10);
  tryCandidate(command.group, 12);
  if (command.keywords) {
    for (const kw of command.keywords) tryCandidate(kw, 14);
  }

  return best;
}

// Module-level singleton registry.
export const commandRegistry = new CommandRegistry();

export function registerCommand(command: Command): () => void {
  return commandRegistry.register(command);
}

export function unregister(id: string): void {
  commandRegistry.unregister(id);
}

export function searchCommands(query: string): ReadonlyArray<CommandSearchHit> {
  return commandRegistry.search(query);
}

export function runCommand(
  commandId: string,
  ctx: CommandRunContext,
): void | Promise<void> {
  return commandRegistry.run(commandId, ctx);
}

export function getRecentCommandIds(limit = 5): string[] {
  return commandRegistry.getRecentCommandIds(limit);
}

export function getFrequentCommandIds(limit = 5): string[] {
  return commandRegistry.getFrequentCommandIds(limit);
}

/**
 * React hook that returns the live list of registered commands.
 * Uses `useSyncExternalStore` so it plays nice with concurrent rendering.
 */
export function useCommands(): ReadonlyArray<Command> {
  const subscribe = React.useCallback(
    (onChange: () => void) => commandRegistry.subscribe(onChange),
    [],
  );
  const getSnapshot = React.useCallback(() => commandRegistry.list(), []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Re-export for tests.
export { CommandRegistry };
