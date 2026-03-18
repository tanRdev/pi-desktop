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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project icon</DialogTitle>
          <DialogDescription>
            Pick a sober icon for {repositoryName}. Auto derives from the
            project name.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
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
                className={[
                  "flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition",
                  isSelected
                    ? "border-border bg-surface-2 text-foreground shadow-sm"
                    : "border-border/70 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground",
                ].join(" ")}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
