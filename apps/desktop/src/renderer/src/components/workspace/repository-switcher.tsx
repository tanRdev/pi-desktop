import { Folder, Plus, Stack } from "@phosphor-icons/react";
import type { RepositorySnapshot } from "@pi-desktop/shared";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

function getPathTail(value: string): string {
  const segments = value.split(/[\\/]+/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

export interface RepositorySwitcherProps {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  onSelect: (repositoryId: string) => void | Promise<void>;
  onAdd: () => void | Promise<void>;
  triggerLabel?: string;
  triggerSubtitle?: string;
  triggerAriaLabel?: string;
  className?: string;
}

export function RepositorySwitcher({
  repositories: _repositories,
  activeRepositoryId: _activeRepositoryId,
  onSelect: _onSelect,
  onAdd: _onAdd,
  triggerLabel: _triggerLabel,
  triggerSubtitle: _triggerSubtitle,
  triggerAriaLabel: _triggerAriaLabel,
  className: _className,
}: RepositorySwitcherProps) {
  // Component intentionally returns null - the switcher button has been removed
  return null;
}
