import type { RepositorySnapshot } from "@pidesk/shared";
import {
  FolderGit,
  Code2,
  Database,
  Globe,
  Layers,
  Box,
  Terminal,
  Settings,
  FileCode,
  Cpu,
  Smartphone,
  Layout,
  Server,
  Shield,
  Zap,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProjectAvatarProps {
  repository: RepositorySnapshot;
  isActive: boolean;
  onClick: () => void;
}

// Map repository names to appropriate icons based on common project types
function getIconForRepository(name: string): LucideIcon {
  const lower = name.toLowerCase();
  
  // Development tools
  if (lower.includes("api")) return Server;
  if (lower.includes("app")) return Layout;
  if (lower.includes("web")) return Globe;
  if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android")) return Smartphone;
  if (lower.includes("desktop")) return Monitor;
  if (lower.includes("cli") || lower.includes("cmd")) return Terminal;
  if (lower.includes("ui") || lower.includes("component")) return Layout;
  
  // Language/framework specific
  if (lower.includes("react")) return Code2;
  if (lower.includes("node") || lower.includes("js") || lower.includes("ts")) return FileCode;
  if (lower.includes("python") || lower.includes("py")) return Terminal;
  if (lower.includes("go") || lower.includes("rust") || lower.includes("c++")) return Cpu;
  
  // Data/Infra
  if (lower.includes("db") || lower.includes("sql") || lower.includes("data")) return Database;
  if (lower.includes("infra") || lower.includes("deploy")) return Server;
  if (lower.includes("config") || lower.includes("dotfiles")) return Settings;
  if (lower.includes("security") || lower.includes("auth")) return Shield;
  
  // Generic project types
  if (lower.includes("lib") || lower.includes("package") || lower.includes("sdk")) return Box;
  if (lower.includes("plugin") || lower.includes("ext")) return Zap;
  if (lower.includes("mono") || lower.includes("multi")) return Layers;
  
  // Default to git folder icon
  return FolderGit;
}

function getAvatarColor(id: string): string {
  const colors = [
    "bg-rose-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-cyan-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-fuchsia-500",
    "bg-pink-500",
  ];
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? "bg-zinc-500";
}

export function ProjectAvatar({ repository, isActive, onClick }: ProjectAvatarProps) {
  const Icon = getIconForRepository(repository.name);
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-surface-3 ring-1 ring-border-hover shadow-sm"
          : "hover:bg-surface-2 hover:ring-1 hover:ring-border"
      )}
      title={repository.name}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shadow-sm",
          getAvatarColor(repository.id)
        )}
      >
        <Icon className="h-4 w-4 text-white" />
      </span>
      {isActive && (
        <span className="absolute -right-px top-1/2 h-4 w-1 -translate-y-1/2 rounded-l bg-foreground" />
      )}
    </button>
  );
}

