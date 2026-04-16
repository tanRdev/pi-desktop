import { SidebarSimple, TerminalWindow } from "@/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getTrafficLightInset } from "../../lib/title-bar-layout";

export interface TitleBarProps {
  platform: string | null;
  isTerminalActive: boolean;
  isRightSidebarVisible: boolean;
  onOpenTerminal: () => void;
  onToggleRightSidebar: () => void;
}

interface TitleBarControlButton {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

export function TitleBar({
  platform,
  isTerminalActive,
  isRightSidebarVisible,
  onOpenTerminal,
  onToggleRightSidebar,
}: TitleBarProps) {
  const controlButtons: TitleBarControlButton[] = [
    {
      icon: TerminalWindow,
      label: "Open terminal",
      onClick: onOpenTerminal,
      isActive: isTerminalActive,
    },
  ];

  return (
    <div
      data-drag-region="true"
      className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/[0.03] px-4 select-none"
      style={{ paddingLeft: getTrafficLightInset(platform) }}
    >
      <div data-slot="titlebar-project" className="flex min-w-0 items-center">
        <div data-testid="titlebar-project-name" className="sr-only" />
      </div>

      <div
        data-slot="titlebar-controls"
        data-no-drag="true"
        className="flex items-center gap-1.5"
      >
        <TooltipProvider>
          <div className="flex items-center gap-1.5">
            {controlButtons.map(({ icon: Icon, label, onClick, isActive }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onClick}
                    aria-label={label}
                    className={cn(
                      "flex size-8 items-center justify-center text-white/40 outline-none ring-0 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/80 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
                      isActive && "bg-white/[0.04] text-white/80",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  {label}
                </TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleRightSidebar}
                  aria-label="Toggle side panel"
                  className={cn(
                    "flex size-8 items-center justify-center text-white/40 outline-none ring-0 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/80 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
                    isRightSidebarVisible && "bg-white/[0.04] text-white/80",
                  )}
                >
                  <SidebarSimple className="size-4 -scale-x-100" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                Toggle side panel
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
