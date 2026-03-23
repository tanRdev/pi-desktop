import type { WorktreeSnapshot } from "@pidesk/shared";
import { getTitleBarLeftPadding } from "../../lib/title-bar-layout";

export interface TitleBarProps {
  projectName: string;
  platform: NodeJS.Platform | string | null;
  activeWorktreeLabel: string | null;
  worktrees: WorktreeSnapshot[];
  activeWorktreeId: string | null;
  isMainWindowFullscreen: boolean;
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
}

export function TitleBar({
  projectName,
  platform,
  isMainWindowFullscreen,
}: TitleBarProps) {
  const leftPadding = getTitleBarLeftPadding({
    isFullscreen: isMainWindowFullscreen,
    platform,
  });

  return (
    <div
      data-testid="title-bar"
      data-drag-region="true"
      className="titlebar relative z-50 flex h-12 shrink-0 items-center gap-4 border-b border-[#474747]/24 bg-[#0d0d0d] px-4"
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-3"
        data-slot="titlebar-project"
        style={{ paddingLeft: `${leftPadding}px` }}
      >
        <div className="min-w-0 space-y-0.5" data-no-drag="true">
          <p
            data-testid="titlebar-project-name"
            className="truncate text-sm font-medium text-white"
          >
            {projectName}
          </p>
        </div>
      </div>
    </div>
  );
}
