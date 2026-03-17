import type { RepositorySnapshot } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProjectAvatarProps {
  repository: RepositorySnapshot;
  isActive: boolean;
  onClick: () => void;
}

function getInitials(name: string): string {
  // Split by common separators and filter out empty strings
  const words = name.split(/[-_\s]+/).filter((w) => w.length > 0);

  if (words.length === 0) return "?";

  const firstWord = words[0]!;
  if (words.length === 1) {
    // Single word: take first 2 characters
    return firstWord.slice(0, 2).toUpperCase();
  }

  // Multiple words: take first letter of first two words
  const first = firstWord.charAt(0);
  const second = words[1]?.charAt(0) ?? "";
  return (first + second).toUpperCase();
}

export function ProjectAvatar({
  repository,
  isActive,
  onClick,
}: ProjectAvatarProps) {
  const initials = getInitials(repository.name);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group relative flex aspect-square w-full items-center justify-center",
        "cursor-pointer",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isActive
          ? "bg-surface-3 text-foreground"
          : "text-muted-foreground/60 hover:bg-surface-2 hover:text-muted-foreground",
      )}
      title={repository.name}
    >
      {/* Initials with subtle scale on active */}
      <span
        className={cn(
          "text-sm font-medium tracking-wide transition-transform duration-200 ease-out",
          isActive && "scale-110",
        )}
      >
        {initials}
      </span>

      {/* Active indicator - elegant left accent */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 bg-foreground" />
      )}
    </button>
  );
}
