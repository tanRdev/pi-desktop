import {
  Box,
  Code2,
  Cpu,
  Database,
  FolderGit,
  Layout,
  type LucideIcon,
  Monitor,
  Server,
  Settings,
  Terminal,
} from "lucide-react";
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
  icon: LucideIcon;
}

export const PROJECT_ICON_OPTIONS: ProjectIconOption[] = [
  { id: "auto", label: "Auto", icon: FolderGit },
  { id: "repository", label: "Repository", icon: FolderGit },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "server", label: "Service", icon: Server },
  { id: "database", label: "Database", icon: Database },
  { id: "layout", label: "Interface", icon: Layout },
  { id: "package", label: "Package", icon: Box },
  { id: "system", label: "System", icon: Cpu },
  { id: "code", label: "Code", icon: Code2 },
  { id: "settings", label: "Config", icon: Settings },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

const DEFAULT_PROJECT_ICON_OPTION: ProjectIconOption = {
  id: "repository-fallback",
  label: "Repository",
  icon: FolderGit,
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
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="p-6">
          <DialogTitle className="text-sm font-bold uppercase tracking-[0.2em] font-headline text-white">
            Project Icon
          </DialogTitle>
          <DialogDescription className="text-[10px] font-mono text-[#474747] uppercase tracking-wider mt-2">
            SELECT A TECHNICAL GLYPH FOR {repositoryName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-0 border-t border-[#474747]/20 bg-[#131313]">
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
                  "flex flex-col items-center justify-center gap-3 p-6 text-center border-b border-r border-[#474747]/10 transition-all duration-75",
                  "hover:bg-[#353535] hover:text-white",
                  isSelected
                    ? "bg-[#0e0e0e] text-white border-b-white"
                    : "text-[#474747]",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-none border border-[#474747]/30 bg-[#131313]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em]">
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
