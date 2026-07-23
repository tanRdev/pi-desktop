import { Layer } from "effect";
import type { RepositoryCatalog } from "../catalogs/repository-catalog";
import {
  GitWorktreeServiceLive,
  RepositoryCatalogLive,
  TerminalManagerLive,
} from "../effect/layers";
import { PiDesktopLive } from "../effect/runtime";
import type {
  GitWorktreeServiceServiceOps,
  RepositoryCatalogServiceOps,
  TerminalManagerServiceOps,
} from "../effect/services";
import type { GitWorktreeService } from "../git-worktree-service";
import {
  SessionCapabilityLive,
  type SessionCapabilityServiceOps,
} from "../session/session-capability";
import type { TerminalManager } from "../terminal-manager";

export type DesktopMainServices = RepositoryCatalogServiceOps &
  GitWorktreeServiceServiceOps &
  TerminalManagerServiceOps &
  SessionCapabilityServiceOps;

/**
 * One Effect Layer graph for main-process capabilities Spine 3 owns.
 * Callers provide concrete instances constructed at boot; the Layer is SoT
 * for Effect boundaries (no parallel imperative-only theater).
 */
export function createDesktopMainLayer(input: {
  repositoryCatalog: RepositoryCatalog;
  gitService: GitWorktreeService;
  terminalManager: TerminalManager;
  sessionCapability: SessionCapabilityServiceOps;
}): Layer.Layer<DesktopMainServices, never, never> {
  return Layer.mergeAll(
    PiDesktopLive as Layer.Layer<never, never, never>,
    RepositoryCatalogLive(input.repositoryCatalog),
    GitWorktreeServiceLive(input.gitService),
    TerminalManagerLive(input.terminalManager),
    SessionCapabilityLive(input.sessionCapability),
  ) as Layer.Layer<DesktopMainServices, never, never>;
}
