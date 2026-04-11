import {
  Folder,
  Gear,
  MagnifyingGlass,
  SidebarSimple,
  SquaresFour,
  TerminalWindow,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { getTrafficLightInset } from "../../lib/title-bar-layout";

type RepositorySnapshot = import("@pidesk/shared").RepositorySnapshot;

export interface TitleBarProps {
  platform: string | null;
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeRepositoryName: string;
  activeWorktree: RepositorySnapshot["worktrees"][number] | null;
  activeSurfaceKind: "activity" | "file" | "terminal" | "git" | null;
  isSidePanelVisible: boolean;
  onSelectRepository: (repositoryId: string) => void | Promise<void>;
  onAddRepository: () => void | Promise<void>;
  onOpenMarketplace: () => void;
  onOpenFileTree: () => void;
  onOpenTerminal: () => void;
  onOpenGit: () => void;
  onOpenSettings: () => void;
  onToggleSidePanel: () => void;
}

interface TitleBarControlButton {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

export function TitleBar({
  platform,
  repositories: _repositories,
  activeRepositoryId: _activeRepositoryId,
  activeRepositoryName: _activeRepositoryName,
  activeWorktree,
  activeSurfaceKind,
  isSidePanelVisible,
  onSelectRepository: _onSelectRepository,
  onAddRepository: _onAddRepository,
  onOpenMarketplace,
  onOpenFileTree,
  onOpenTerminal,
  onOpenGit,
  onOpenSettings,
  onToggleSidePanel,
}: TitleBarProps) {
  const canOpenFileTree = activeWorktree !== null;
  const fileTreeLabel = canOpenFileTree
    ? "Browse files"
    : "Select a worktree to browse files";

  const controlButtons: TitleBarControlButton[] = [
    {
      icon: MagnifyingGlass,
      label: "Open launcher",
      onClick: onOpenMarketplace,
      isActive: false,
    },
    {
      icon: Folder,
      label: fileTreeLabel,
      onClick: onOpenFileTree,
      disabled: !canOpenFileTree,
    },
    {
      icon: TerminalWindow,
      label: "Open terminal",
      onClick: onOpenTerminal,
      isActive: activeSurfaceKind === "terminal",
    },
    {
      icon: SquaresFour,
      label: "Open git",
      onClick: onOpenGit,
      isActive: activeSurfaceKind === "git",
    },
    {
      icon: Gear,
      label: "Open settings",
      onClick: onOpenSettings,
      isActive: false,
    },
  ];

  return (
    <div
      data-drag-region="true"
      className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/[0.03] px-4 select-none"
      style={{ paddingLeft: getTrafficLightInset(platform) }}
    >
      <div data-slot="titlebar-project" className="flex min-w-0 items-center">
        <div data-testid="titlebar-project-name" className="sr-only" />
      </div>

      <div
        data-slot="titlebar-controls"
        data-no-drag="true"
        className="flex items-center gap-1.5"
      >
        <div className="flex items-center gap-1.5">
          {controlButtons.map(
            ({ icon: Icon, label, onClick, isActive, disabled }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                disabled={disabled}
                title={label}
                aria-label={label}
                className={cn(
                  "flex size-8 items-center justify-center rounded-sm text-white/30 outline-none ring-0 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
                  isActive && "bg-white/[0.04] text-white/70",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <Icon className="size-4" />
              </button>
            ),
          )}
          <button
            type="button"
            onClick={onToggleSidePanel}
            aria-label="Toggle side panel"
            className={cn(
              "flex size-8 items-center justify-center rounded-sm text-white/30 outline-none ring-0 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
              isSidePanelVisible && "text-white/70",
            )}
          >
            <SidebarSimple className="size-5 -scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
