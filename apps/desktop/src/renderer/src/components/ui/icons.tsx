/**
 * Icon wrapper using Hugeicons with Emil Design principles
 * - Hover/active states with subtle scale transforms
 * - Reduced motion support
 * - Custom easing via CSS variable --ease-out
 */
import { HugeiconsIcon } from "@hugeicons/react";
import type { HugeiconsIconProps, IconSvgElement } from "@hugeicons/react";
import * as React from "react";
export type { IconSvgElement };
export type Icon = React.ComponentType<any>;

// Import all icons we need from core-free-icons
import {
  // Navigation & Arrows
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,

  // Cancellation
  Cancel01Icon,
  CancelCircleIcon,

  // Files & Folders
  File01Icon,
  File02Icon,
  Folder01Icon,
  Folder02Icon,
  FolderOpenIcon,
  FolderTreeIcon,
  SaveIcon,

  // Communication
  Message01Icon,

  // Actions / UI
  Add01Icon,
  AddSquareIcon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  Edit02Icon,
  Edit02Icon as PencilEdit02Icon,
  RefreshIcon,
  RotateLeftIcon,

  // Status
  AlertCircleIcon,
  AlertSquareIcon,
  Tick01Icon,
  Loading02Icon,

  // Media
  Image01Icon,
  Image02Icon,

  // Development
  CodeIcon,
  CommandIcon,
  GitBranchIcon,
  ComputerTerminal01Icon,
  ComputerTerminal01Icon as TerminalIcon,

  // Layout / Visual
  LayoutLeftIcon,
  Layout01Icon,
  LayoutRightIcon,
  Settings01Icon,
  Settings02Icon,
  StickyNote01Icon,
  StickyNote02Icon,

  // Business / Links
  Archive01Icon,
  AtIcon,
  Link02Icon,

  // Devices / Hardware
  SmartPhone01Icon,
  SmartPhone01Icon as SmartphoneIcon,
  ComputerIcon,
  ComputerIcon as MonitorIcon,
  ServerStack01Icon,
  ServerStack01Icon as ServerIcon,

  // Database
  Database01Icon,
  Database01Icon as DatabaseIcon,
  Database02Icon,

  // Security / Misc
  Shield01Icon,
  Shield02Icon,
  BinaryCodeIcon,
  BinaryCodeIcon as BinaryIcon,
  PackageIcon,
  PackageIcon as BoxIcon,
  CpuIcon,
  GlobeIcon,
  LayersIcon,
  ZapIcon,

  // AI / Misc
  BotIcon,
  MagicWand01Icon,

  // Keyboard / Colors
  KeyboardIcon,
  ColorsIcon,
} from "@hugeicons/core-free-icons";

/**
 * CSS class utilities for Emil Design icon states
 * These classes enable consistent hover/active animations across all icons
 */
export const iconStateClasses = {
  // Base interactive state classes for icons
  interactive: "motion-safe:transition-transform motion-safe:duration-150",
  // Hover state: subtle scale up
  hover: "motion-safe:hover:scale-110",
  // Active state: subtle scale down for pressed feedback
  active: "motion-safe:active:scale-90",
  // Combined hover and active states
  hoverActive: "motion-safe:hover:scale-110 motion-safe:active:scale-90",
  // Reduced motion: disable transitions
  motionReduce: "motion-reduce:transition-none motion-reduce:transform-none",
} as const;

/**
 * Easing function used throughout Emil Design
 * Custom cubic-bezier for smooth, natural-feeling animations
 */
export const EMIL_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Duration constants (in ms) for consistent timing
 * All durations under 300ms per Emil Design principles
 */
export const EMIL_DURATIONS = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

// Helper to create an icon component with Emil Design interactions
function createIconComponent(
  icon: HugeiconsIconProps["icon"],
  defaultProps?: Partial<HugeiconsIconProps> & {
    enableHoverScale?: boolean;
    enableActiveScale?: boolean;
  }
) {
  const IconComponent = React.forwardRef<
    HTMLSpanElement,
    Omit<HugeiconsIconProps, "icon"> & {
      className?: string;
      // Emil Design: allow consumers to opt into hover/active states
      interactive?: boolean;
    }
  >(({ className, size, color, strokeWidth, interactive, ...props }, ref) => {
    // Extract size from className (e.g., "size-4" -> 16)
    let iconSize = size || 24;
    if (className?.includes("size-")) {
      const sizeMatch = className.match(/size-(\d+\.?\d*)/);
      if (sizeMatch) {
        const sizeValue = parseFloat(sizeMatch[1] ?? "0");
        // Tailwind size-* is typically in rems (0.25rem = 4px)
        iconSize = sizeValue * 4;
      }
    }
    if (className?.includes("h-")) {
      const hMatch = className.match(/h-(\d+\.?\d*)/);
      if (hMatch) {
        iconSize = parseFloat(hMatch[1] ?? "0") * 4;
      }
    }
    if (className?.includes("w-")) {
      const wMatch = className.match(/w-(\d+\.?\d*)/);
      if (wMatch) {
        iconSize = parseFloat(wMatch[1] ?? "0") * 4;
      }
    }

    // Build className with Emil Design state classes when interactive
    const enhancedClassName = React.useMemo(() => {
      const classes: string[] = [className || ""];

      if (
        interactive ||
        defaultProps?.enableHoverScale ||
        defaultProps?.enableActiveScale
      ) {
        classes.push(iconStateClasses.interactive);
        classes.push(iconStateClasses.motionReduce);

        if (interactive || defaultProps?.enableHoverScale) {
          classes.push(iconStateClasses.hover);
        }
        if (interactive || defaultProps?.enableActiveScale) {
          classes.push(iconStateClasses.active);
        }
      }

      return classes.join(" ");
    }, [
      className,
      interactive,
      defaultProps?.enableHoverScale,
      defaultProps?.enableActiveScale,
    ]);

    return (
      <span
        ref={ref}
        className={enhancedClassName}
        style={{
          // Emil Design: consistent transition timing
          transitionTimingFunction: "var(--ease-out, " + EMIL_EASE_OUT + ")",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <HugeiconsIcon
          icon={icon}
          size={iconSize}
          color={color || "currentColor"}
          strokeWidth={strokeWidth || 1.5}
        />
      </span>
    );
  });
  IconComponent.displayName = "Icon";
  return IconComponent;
}

// Export icon components
export const AlertCircle = createIconComponent(AlertCircleIcon);
export const Archive = createIconComponent(Archive01Icon);
export const ArrowUp = createIconComponent(ArrowUp01Icon);
export const AtSign = createIconComponent(AtIcon);
export const Binary = createIconComponent(BinaryCodeIcon);
export const Bot = createIconComponent(BotIcon);
export const Box = createIconComponent(PackageIcon);
export const Check = createIconComponent(Tick01Icon);
export const ChevronDown = createIconComponent(ArrowDown01Icon);
export const ChevronRight = createIconComponent(ArrowRight01Icon);
export const ChevronLeft = createIconComponent(ArrowLeft01Icon);
export const ChevronUp = createIconComponent(ArrowUp01Icon);
export const Circle = createIconComponent(CancelCircleIcon); // Using cancel circle as placeholder
export const Code2 = createIconComponent(CodeIcon);
export const Command = createIconComponent(CommandIcon);
export const Cpu = createIconComponent(CpuIcon);
export const Database = createIconComponent(Database01Icon);
export const File = createIconComponent(File01Icon);
export const FileCode = createIconComponent(File02Icon);
export const FileIcon = createIconComponent(File01Icon);
export const FileText = createIconComponent(File02Icon);
export const FileWarning = createIconComponent(AlertSquareIcon);
export const Folder = createIconComponent(Folder01Icon);
export const FolderGit = createIconComponent(Folder02Icon);
export const FolderOpen = createIconComponent(FolderOpenIcon);
export const FolderTree = createIconComponent(FolderTreeIcon);
export const GitBranch = createIconComponent(GitBranchIcon);
export const Globe = createIconComponent(GlobeIcon);
export const Image = createIconComponent(Image01Icon);
export const Keyboard = createIconComponent(KeyboardIcon);
export const Layers = createIconComponent(LayersIcon);
export const Layout = createIconComponent(Layout01Icon);
export const Link2 = createIconComponent(Link02Icon);
export const Loader2 = createIconComponent(Loading02Icon);
export const Icon = createIconComponent(MagicWand01Icon);
export const MessageSquare = createIconComponent(Message01Icon);
export const Monitor = createIconComponent(ComputerIcon);
export const Palette = createIconComponent(ColorsIcon);
export const PanelLeft = createIconComponent(LayoutLeftIcon);
export const PanelLeftClose = createIconComponent(LayoutLeftIcon);
export const Pencil = createIconComponent(PencilEdit02Icon);
export const Plus = createIconComponent(Add01Icon);
export const RefreshCw = createIconComponent(RefreshIcon);
export const RotateCcw = createIconComponent(RotateLeftIcon);
export const Save = createIconComponent(SaveIcon);
export const Server = createIconComponent(ServerStack01Icon);
export const Settings = createIconComponent(Settings01Icon);
export const Settings2 = createIconComponent(Settings02Icon);
export const Shield = createIconComponent(Shield01Icon);
export const Smartphone = createIconComponent(SmartPhone01Icon);
export const StickyNote = createIconComponent(StickyNote01Icon);
export const Terminal = createIconComponent(ComputerTerminal01Icon);
export const X = createIconComponent(Cancel01Icon);
export const XCircle = createIconComponent(CancelCircleIcon);
export const Zap = createIconComponent(ZapIcon);

// Special components that need different handling
export const CheckCircle = createIconComponent(CheckmarkCircle02Icon);

// Re-export HugeiconsIcon for direct usage
export { HugeiconsIcon };

// Also export raw icon objects for direct use with HugeiconsIcon
export {
  // Navigation & Arrows
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Cancel01Icon,
  CancelCircleIcon,

  // Files & Folders
  File01Icon,
  File02Icon,
  Folder01Icon,
  Folder02Icon,
  FolderOpenIcon,
  FolderTreeIcon,
  SaveIcon,

  // Communication
  Message01Icon,

  // Actions / UI
  Add01Icon,
  AddSquareIcon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  RotateLeftIcon,

  // Status
  AlertCircleIcon,
  AlertSquareIcon,
  Tick01Icon,
  Loading02Icon,

  // Media
  Image01Icon,
  Image02Icon,

  // Development
  CodeIcon,
  CommandIcon,
  GitBranchIcon,
  ComputerTerminal01Icon,

  // Layout / Visual
  LayoutLeftIcon,
  Layout01Icon,
  LayoutRightIcon,
  Settings01Icon,
  Settings02Icon,
  StickyNote01Icon,
  StickyNote02Icon,

  // Business / Links
  Archive01Icon,
  AtIcon,
  Link02Icon,

  // Devices / Hardware
  SmartPhone01Icon,
  ComputerIcon,
  ServerStack01Icon,

  // Database
  Database01Icon,
  Database02Icon,

  // Security / Misc
  Shield01Icon,
  Shield02Icon,
  BinaryCodeIcon,
  PackageIcon,
  CpuIcon,
  GlobeIcon,
  LayersIcon,
  ZapIcon,

  // AI / Misc
  BotIcon,
  MagicWand01Icon,

  // Keyboard / Colors
  KeyboardIcon,
  ColorsIcon,
};
