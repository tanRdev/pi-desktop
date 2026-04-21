import * as React from "react";

export type SidebarTab = "workspaces" | "git" | "files";

export const SIDEBAR_WIDTH = 260;
export const MIN_SIDEBAR_WIDTH = 160;
export const MAX_SIDEBAR_WIDTH = 480;
const COLLAPSE_THRESHOLD = 100;

export interface UseLeftSidebarLayoutOptions {
  width: number;
  activeRepositoryId: string | null;
  activeTabOverride?: SidebarTab;
  onResize: (width: number) => void;
  onSelectRepository: (repositoryId: string) => void;
  onCreateSession: () => void | Promise<void>;
}

export interface LeftSidebarLayoutController {
  isCollapsed: boolean;
  isCreatingSession: boolean;
  activeTab: SidebarTab;
  expandedRepositoryIds: Set<string>;
  setActiveTab: (tab: SidebarTab) => void;
  handleSelectProject: (repositoryId: string) => void;
  handleCreateSession: () => Promise<void>;
  handleHideSidebar: () => void;
  handleShowSidebar: () => void;
  handleResizeDragStart: (
    event: Pick<React.MouseEvent, "clientX" | "preventDefault">,
  ) => void;
}

export function useLeftSidebarLayout({
  width,
  activeRepositoryId,
  activeTabOverride,
  onResize,
  onSelectRepository,
  onCreateSession,
}: UseLeftSidebarLayoutOptions): LeftSidebarLayoutController {
  const isCollapsed = width <= 0;
  const lastExpandedWidthRef = React.useRef(width > 0 ? width : SIDEBAR_WIDTH);
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);
  const [expandedRepositoryIds, setExpandedRepositoryIds] = React.useState<
    Set<string>
  >(() => (activeRepositoryId ? new Set([activeRepositoryId]) : new Set()));
  const [activeTab, setActiveTab] = React.useState<SidebarTab>("workspaces");

  React.useEffect(() => {
    if (width > 0) {
      lastExpandedWidthRef.current = width;
    }
  }, [width]);

  React.useEffect(() => {
    setExpandedRepositoryIds(() => {
      if (activeRepositoryId) {
        return new Set([activeRepositoryId]);
      }
      return new Set();
    });
  }, [activeRepositoryId]);

  React.useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  const handleCreateSession = React.useCallback(async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      await onCreateSession();
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession, onCreateSession]);

  const handleSelectProject = React.useCallback(
    (repositoryId: string) => {
      const isActive = repositoryId === activeRepositoryId;
      const isExpanded = expandedRepositoryIds.has(repositoryId);

      setExpandedRepositoryIds((current) => {
        if (isActive && isExpanded) {
          const next = new Set(current);
          next.delete(repositoryId);
          return next;
        }
        return new Set([repositoryId]);
      });

      if (!isActive) {
        onSelectRepository(repositoryId);
      }
    },
    [activeRepositoryId, expandedRepositoryIds, onSelectRepository],
  );

  const handleHideSidebar = React.useCallback(() => {
    if (isCollapsed) return;
    onResize(0);
  }, [isCollapsed, onResize]);

  const handleShowSidebar = React.useCallback(() => {
    onResize(lastExpandedWidthRef.current);
  }, [onResize]);

  const handleResizeDragStart = React.useCallback(
    (event: Pick<React.MouseEvent, "clientX" | "preventDefault">) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = startWidth + delta;

        if (newWidth < COLLAPSE_THRESHOLD) {
          onResize(0);
          return;
        }

        onResize(
          Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth)),
        );
      };

      const handleMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, onResize],
  );

  return {
    isCollapsed,
    isCreatingSession,
    activeTab,
    expandedRepositoryIds,
    setActiveTab,
    handleSelectProject,
    handleCreateSession,
    handleHideSidebar,
    handleShowSidebar,
    handleResizeDragStart,
  };
}
