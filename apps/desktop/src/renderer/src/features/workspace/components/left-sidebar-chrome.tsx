import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@pi-desktop/ui";
import { Plus } from "@/components/ui/phosphor-icons";
import type { SidebarTab } from "./use-left-sidebar-layout";

const SIDEBAR_TABS: ReadonlyArray<{ id: SidebarTab; label: string }> = [
  { id: "workspaces", label: "Workspaces" },
  { id: "git", label: "Git" },
  { id: "files", label: "Files" },
];

export interface LeftSidebarTabsProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
}

export function LeftSidebarTabs({
  activeTab,
  onSelectTab,
}: LeftSidebarTabsProps) {
  return (
    <div
      data-no-drag="true"
      className="flex h-11 w-full shrink-0 items-center gap-1 px-3"
      role="tablist"
      aria-label="Sidebar tabs"
    >
      {SIDEBAR_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`sidebar-tab-${tab.id}`}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              "flex-1 h-8 px-3 text-[11px] uppercase tracking-wider font-medium text-center",
              "transition-colors duration-150 border-b border-transparent",
              isActive
                ? "text-white/90 border-[var(--color-accent)]"
                : "text-white/40 hover:text-white/70",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export interface LeftSidebarAddWorkspaceButtonProps {
  onAddWorkspace: () => void;
}

export function LeftSidebarAddWorkspaceButton({
  onAddWorkspace,
}: LeftSidebarAddWorkspaceButtonProps) {
  return (
    <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onAddWorkspace}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-sm",
              "px-3 py-2 text-[11px] font-medium uppercase tracking-wider",
              "border border-white/[0.06] bg-white/[0.02] text-white/50",
              "transition-all duration-150",
              "hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/70",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
            )}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add workspace
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Add a new workspace</TooltipContent>
      </Tooltip>
    </div>
  );
}
