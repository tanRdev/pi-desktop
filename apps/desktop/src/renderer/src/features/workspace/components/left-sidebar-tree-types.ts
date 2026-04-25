import type { RepositorySnapshot } from "@pi-desktop/shared";
import type * as React from "react";

export type IndicatorState = "streaming" | "unread" | "idle";

export type ThreadContextMenuHandler = (
  event: React.MouseEvent,
  threadId: string,
  threadTitle: string,
) => void;

export type WorktreeContextMenuHandler = (
  event: React.MouseEvent,
  worktreeId: string,
  worktreeLabel: string,
) => void;

export function getRepositoryName(repository: RepositorySnapshot): string {
  return repository.customName?.trim() || repository.name;
}

export function passiveIndicatorState(state: IndicatorState): IndicatorState {
  if (state === "streaming") return "streaming";
  if (state === "unread") return "unread";
  return "idle";
}
