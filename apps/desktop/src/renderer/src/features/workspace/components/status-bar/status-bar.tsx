import type { GitRepositoryStatus, ShellGitSnapshot } from "@pi-desktop/shared";

import {
  Brain,
  GitBranch,
  ICON_SIZE_XS,
  PencilSimple,
  Pulse,
  Settings,
} from "@/components/ui/icons";
import { useNotifications } from "@/features/notifications/use-notifications";
import { cn } from "@/lib/utils";

import { StatusBarItem } from "./status-bar-item";
import { useStatusBarData } from "./use-status-bar-data";

export interface StatusBarProps {
  gitStatus?: GitRepositoryStatus | null;
  shellGit?: ShellGitSnapshot | null;
  currentModelValue?: string | null;
  className?: string;
}

const SETTINGS_COMMAND_ID = "open-settings";

function dispatchOpenSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("pi:command", {
      detail: { commandId: SETTINGS_COMMAND_ID },
    }),
  );
}

/**
 * Bottom-anchored status bar showing branch, change counts, active model
 * placeholder, notifications count, and a settings affordance. Each cell
 * hides itself when its data is unavailable so the bar gracefully shrinks
 * to the items that have meaningful state.
 */
export function StatusBar({
  gitStatus,
  shellGit,
  currentModelValue,
  className,
}: StatusBarProps) {
  // Always subscribe to the notifications center; it returns an empty
  // list when nothing has been pushed which keeps the cell hidden until
  // B6's wiring lights it up.
  const { notifications } = useNotifications();

  const data = useStatusBarData({
    gitStatus,
    shellGit,
    currentModelValue,
    notificationsCount: notifications.length,
  });

  const totalChanges = data.stagedCount + data.unstagedCount;

  return (
    <footer
      data-testid="status-bar"
      className={cn(
        "flex h-6 shrink-0 items-stretch border-t border-white/[0.06]",
        "bg-[var(--color-bg-primary)] text-white/55 select-none",
        className,
      )}
    >
      {data.branchName ? (
        <StatusBarItem
          testId="status-bar-branch"
          icon={<GitBranch className={ICON_SIZE_XS} />}
          label={data.branchName}
          tooltip={`On branch ${data.branchName}`}
          ariaLabel={`Current branch: ${data.branchName}`}
        />
      ) : null}

      {totalChanges > 0 ? (
        <StatusBarItem
          testId="status-bar-changes"
          icon={<PencilSimple className={ICON_SIZE_XS} />}
          label={
            <span className="tabular-nums">
              <span className="text-[var(--color-accent)]/70">
                {data.stagedCount}
              </span>
              <span className="text-white/30">/</span>
              <span className="text-yellow-400/70">{data.unstagedCount}</span>
            </span>
          }
          tooltip={`${data.stagedCount} staged, ${data.unstagedCount} unstaged`}
          ariaLabel={`${data.stagedCount} staged, ${data.unstagedCount} unstaged changes`}
        />
      ) : null}

      <div className="flex-1" />

      <StatusBarItem
        testId="status-bar-model"
        icon={<Brain className={ICON_SIZE_XS} />}
        label={data.activeModel}
        tooltip="Active model"
        ariaLabel={`Active model: ${data.activeModel}`}
      />

      {data.notificationsCount > 0 ? (
        <StatusBarItem
          testId="status-bar-notifications"
          icon={<Pulse className={ICON_SIZE_XS} />}
          label={
            <span className="tabular-nums">{data.notificationsCount}</span>
          }
          tooltip={`${data.notificationsCount} notification${
            data.notificationsCount === 1 ? "" : "s"
          }`}
          ariaLabel={`${data.notificationsCount} notifications`}
        />
      ) : null}

      <StatusBarItem
        testId="status-bar-settings"
        icon={<Settings className={ICON_SIZE_XS} />}
        onClick={dispatchOpenSettings}
        tooltip="Open settings"
        ariaLabel="Open settings"
      />
    </footer>
  );
}
