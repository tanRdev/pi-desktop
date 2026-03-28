import type { RepositorySnapshot } from "@pidesk/shared";
import type { CSSProperties, DragEventHandler } from "react";
import { cn } from "@/lib/utils";
import { resolveProjectIconOption } from "./project-icon-picker";

export interface ProjectAvatarProps {
  repository: RepositorySnapshot;
  isActive?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLButtonElement>;
  onDragEnd?: DragEventHandler<HTMLButtonElement>;
  ariaControls?: string;
  ariaExpanded?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export interface ProjectAccentOption {
  id: string;
  value: string | null;
  label: string;
  swatch: string;
  style: CSSProperties | null;
}

export const PROJECT_ACCENT_OPTIONS: ProjectAccentOption[] = [
  {
    id: "neutral",
    value: null,
    label: "Neutral",
    swatch: "#52525b",
    style: null,
  },
  {
    id: "slate",
    value: "slate",
    label: "Slate",
    swatch: "#64748b",
    style: {
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      color: "#94a3b8",
    },
  },
  {
    id: "steel",
    value: "steel",
    label: "Steel",
    swatch: "#52525b",
    style: {
      backgroundColor: "#18181b",
      borderColor: "#27272a",
      color: "#a1a1aa",
    },
  },
  {
    id: "olive",
    value: "olive",
    label: "Olive",
    swatch: "#65a30d",
    style: {
      backgroundColor: "#1a2e05",
      borderColor: "#365314",
      color: "#84cc16",
    },
  },
  {
    id: "copper",
    value: "copper",
    label: "Copper",
    swatch: "#ea580c",
    style: {
      backgroundColor: "#431407",
      borderColor: "#7c2d12",
      color: "#fb923c",
    },
  },
  {
    id: "ink",
    value: "ink",
    label: "Ink",
    swatch: "#4c1d95",
    style: {
      backgroundColor: "#1e1b4b",
      borderColor: "#312e81",
      color: "#818cf8",
    },
  },
  {
    id: "sky",
    value: "sky",
    label: "Sky",
    swatch: "#0284c7",
    style: {
      backgroundColor: "#0c4a6e",
      borderColor: "#075985",
      color: "#38bdf8",
    },
  },
  {
    id: "rose",
    value: "rose",
    label: "Rose",
    swatch: "#e11d48",
    style: {
      backgroundColor: "#4c0519",
      borderColor: "#881337",
      color: "#fb7185",
    },
  },
];

const DEFAULT_PROJECT_ACCENT_OPTION: ProjectAccentOption = {
  id: "neutral-fallback",
  value: null,
  label: "Neutral",
  swatch: "#52525b",
  style: null,
};

export function resolveProjectAccentOption(
  accentColor: string | null | undefined,
): ProjectAccentOption {
  return (
    PROJECT_ACCENT_OPTIONS.find((option) => option.value === accentColor) ??
    DEFAULT_PROJECT_ACCENT_OPTION
  );
}

export function resolveProjectAccentStyle(
  accentColor: string | null | undefined,
): CSSProperties | null {
  return resolveProjectAccentOption(accentColor).style;
}

export function ProjectAvatar({
  repository,
  isActive = false,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  ariaControls,
  ariaExpanded,
  size = "sm",
  className,
}: ProjectAvatarProps) {
  const displayName = repository.customName ?? repository.name;
  const { icon: Icon } = resolveProjectIconOption(
    repository.icon,
    repository.name,
  );
  const accentStyle = resolveProjectAccentStyle(repository.accentColor);

  // Square avatar - sharp corners as requested
  const avatarClassName = cn(
    "relative flex items-center justify-center",
    "border rounded-md", // Sharp corners, not circular
    "transition-all duration-100",
    "hover:scale-105 active:scale-95",
    size === "md" ? "size-10" : "size-6",
    isActive
      ? "border-[#3f3f46] bg-[#1a1a1a] text-[#e7e7e7]"
      : "border-[#27272a] bg-[#111111] text-[#6a6a6a] hover:border-[#3f3f46] hover:text-[#8a8a8a]",
    className,
  );

  const iconClassName = size === "md" ? "size-5" : "size-3.5";

  const content = (
    <span
      className={cn(
        "flex items-center justify-center rounded-md",
        size === "md" ? "size-8" : "size-4",
        accentStyle ? "border" : "bg-[#0a0a0a]",
      )}
      style={accentStyle ?? undefined}
    >
      <Icon className={iconClassName} />
    </span>
  );

  if (!onClick) {
    return <div className={avatarClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={avatarClassName}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-label={`Open repository ${displayName}`}
      title={displayName}
    >
      {content}
    </button>
  );
}
