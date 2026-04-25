/**
 * Barrel for the left sidebar workspace tree.
 *
 * The tree was split into focused sibling modules per REFACTOR.md §4.6.1 and
 * the §2.1 200-LOC component cap. This file keeps the public surface stable so
 * existing call sites (`left-sidebar.tsx`, `left-sidebar-workspaces-panel.tsx`)
 * keep importing from `./left-sidebar-workspace-tree`.
 */

export { ProjectRow, type ProjectRowProps } from "./left-sidebar-project-row";
export { ThreadRow, type ThreadRowProps } from "./left-sidebar-thread-row";
export {
  SidebarEdgeToggle,
  StatusIndicator,
  TreeConnector,
} from "./left-sidebar-tree-indicators";
export {
  getRepositoryName,
  type IndicatorState,
  passiveIndicatorState,
  type ThreadContextMenuHandler,
  type WorktreeContextMenuHandler,
} from "./left-sidebar-tree-types";
export {
  WorktreeRow,
  type WorktreeRowProps,
} from "./left-sidebar-worktree-row";
