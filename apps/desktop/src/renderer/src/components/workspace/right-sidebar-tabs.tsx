import { GitBranch, TreeStructure } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface RightSidebarTabsProps {
  activeTab: "git" | "files";
  onTabChange: (tab: "git" | "files") => void;
}

const tabs = [
  { key: "git" as const, label: "Git", icon: GitBranch },
  { key: "files" as const, label: "Files", icon: TreeStructure },
];

export function RightSidebarTabs({
  activeTab,
  onTabChange,
}: RightSidebarTabsProps) {
  return (
    <div className="flex h-11 items-center border-b border-white/[0.03] bg-[var(--shell-main-bg)] select-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[10.5px] transition-colors",
              isActive
                ? "border-b border-white/20 text-white/80"
                : "text-white/40 hover:text-white/60",
            )}
          >
            <Icon weight="light" className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
