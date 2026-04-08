import {
  Code,
  Cpu,
  Cube,
  Database,
  Folder,
  Gear,
  HardDrives,
  type Icon,
  Layout,
  Monitor,
  TerminalWindow,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

export interface ProjectIconOption {
  id: string;
  label: string;
  icon: Icon;
}

export const PROJECT_ICON_OPTIONS: ProjectIconOption[] = [
  { id: "auto", label: "Auto", icon: Folder },
  { id: "repository", label: "Repository", icon: Folder },
  { id: "terminal", label: "Terminal", icon: TerminalWindow },
  { id: "server", label: "Service", icon: HardDrives },
  { id: "database", label: "Database", icon: Database },
  { id: "layout", label: "Interface", icon: Layout },
  { id: "package", label: "Package", icon: Cube },
  { id: "system", label: "System", icon: Cpu },
  { id: "code", label: "Code", icon: Code },
  { id: "settings", label: "Config", icon: Gear },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

const DEFAULT_PROJECT_ICON_OPTION: ProjectIconOption = {
  id: "repository-fallback",
  label: "Repository",
  icon: Folder,
};

function getProjectIconOptionById(iconId: string | null | undefined) {
  return PROJECT_ICON_OPTIONS.find((option) => option.id === iconId) ?? null;
}

export function getFallbackProjectIconId(name: string): string {
  const lower = name.toLowerCase();

  if (lower.includes("api") || lower.includes("service")) return "server";
  if (lower.includes("db") || lower.includes("data")) return "database";
  if (lower.includes("desktop")) return "desktop";
  if (lower.includes("terminal") || lower.includes("cli")) return "terminal";
  if (lower.includes("config") || lower.includes("tooling")) return "settings";
  if (lower.includes("ui") || lower.includes("web") || lower.includes("app")) {
    return "layout";
  }
  if (
    lower.includes("sdk") ||
    lower.includes("package") ||
    lower.includes("lib")
  ) {
    return "package";
  }
  if (
    lower.includes("rust") ||
    lower.includes("go") ||
    lower.includes("engine")
  ) {
    return "system";
  }
  if (
    lower.includes("react") ||
    lower.includes("node") ||
    lower.includes("ts")
  ) {
    return "code";
  }

  return "repository";
}

export function resolveProjectIconOption(
  iconId: string | null | undefined,
  repositoryName: string,
): ProjectIconOption {
  const directMatch = getProjectIconOptionById(iconId);
  if (directMatch && directMatch.id !== "auto") {
    return directMatch;
  }

  return (
    getProjectIconOptionById(getFallbackProjectIconId(repositoryName)) ??
    DEFAULT_PROJECT_ICON_OPTION
  );
}

export interface ProjectIconPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositoryName: string;
  value: string | null | undefined;
  onSelect: (iconId: string | null) => void | Promise<void>;
}

export function ProjectIconPicker({
  open,
  onOpenChange,
  repositoryName,
  value,
  onSelect,
}: ProjectIconPickerProps) {
  const selectedIconId = value ?? "auto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 border-white/[0.06] bg-[#0d0d0d]">
        <DialogHeader className="p-6">
          <DialogTitle className="text-sm font-medium uppercase tracking-wider text-white/80">
            Project Icon
          </DialogTitle>
          <DialogDescription className="text-[11px] text-white/30 mt-2">
            Select an icon for {repositoryName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-0 border-t border-white/[0.04] bg-[#0a0a0a]">
          {PROJECT_ICON_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = option.id === selectedIconId;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  void onSelect(option.id === "auto" ? null : option.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 p-6 text-center border-b border-r border-white/[0.04] transition-all duration-150",
                  "hover:bg-white/[0.04] hover:text-white/70",
                  isSelected
                    ? "bg-white/[0.06] text-white/80"
                    : "text-white/30",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[9px] font-mono font-medium uppercase tracking-wider">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
