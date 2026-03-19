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
    swatch: "oklch(56% 0.01 260)",
    style: null,
  },
  {
    id: "slate",
    value: "slate",
    label: "Slate",
    swatch: "oklch(54% 0.018 255)",
    style: {
      backgroundColor: "oklch(90% 0.014 255 / 0.9)",
      borderColor: "oklch(62% 0.018 255 / 0.7)",
      color: "oklch(36% 0.012 255)",
    },
  },
  {
    id: "steel",
    value: "steel",
    label: "Steel",
    swatch: "oklch(55% 0.022 225)",
    style: {
      backgroundColor: "oklch(90% 0.018 225 / 0.9)",
      borderColor: "oklch(62% 0.022 225 / 0.7)",
      color: "oklch(37% 0.018 225)",
    },
  },
  {
    id: "olive",
    value: "olive",
    label: "Olive",
    swatch: "oklch(58% 0.03 140)",
    style: {
      backgroundColor: "oklch(91% 0.018 140 / 0.92)",
      borderColor: "oklch(63% 0.03 140 / 0.72)",
      color: "oklch(40% 0.022 140)",
    },
  },
  {
    id: "copper",
    value: "copper",
    label: "Copper",
    swatch: "oklch(60% 0.05 45)",
    style: {
      backgroundColor: "oklch(91% 0.024 45 / 0.92)",
      borderColor: "oklch(65% 0.045 45 / 0.72)",
      color: "oklch(42% 0.036 45)",
    },
  },
  {
    id: "ink",
    value: "ink",
    label: "Ink",
    swatch: "oklch(47% 0.024 285)",
    style: {
      backgroundColor: "oklch(89% 0.02 285 / 0.9)",
      borderColor: "oklch(58% 0.028 285 / 0.68)",
      color: "oklch(34% 0.022 285)",
    },
  },
];

const DEFAULT_PROJECT_ACCENT_OPTION: ProjectAccentOption = {
  id: "neutral-fallback",
  value: null,
  label: "Neutral",
  swatch: "oklch(56% 0.01 260)",
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
  const outerClassName = cn(
    "group relative flex items-center justify-center border transition-all",
    size === "md" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl",
    isActive
      ? "border-border bg-surface-2 text-foreground shadow-sm"
      : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground",
    className,
  );
  const innerClassName = cn(
    "flex items-center justify-center border shadow-sm",
    size === "md" ? "h-10 w-10 rounded-2xl" : "h-8 w-8 rounded-lg",
    accentStyle
      ? "border-current/20"
      : "border-border bg-surface-1 text-foreground/80",
  );
  const iconClassName = size === "md" ? "h-5 w-5" : "h-4 w-4";

  const content = (
    <span className={innerClassName} style={accentStyle ?? undefined}>
      <Icon className={iconClassName} />
    </span>
  );

  if (!onClick) {
    return <div className={outerClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={outerClassName}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-label={`Open repository ${displayName}`}
      title={displayName}
    >
      {content}
    </button>
  );
}
