/**
 * Icon wrapper using Hugeicons
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

// Helper to create an icon component
function createIconComponent(icon: HugeiconsIconProps["icon"], defaultProps?: Partial<HugeiconsIconProps>) {
  const IconComponent = React.forwardRef<HTMLSpanElement, Omit<HugeiconsIconProps, "icon"> & { className?: string }>(
    ({ className, size, color, strokeWidth, ...props }, ref) => {
      // Extract size from className (e.g., "size-4" -> 16)
      let iconSize = size || 24;
      if (className?.includes("size-")) {
        const sizeMatch = className.match(/size-(\d+\.?\d*)/);
        if (sizeMatch) {
          const sizeValue = parseFloat(sizeMatch[1] ?? '0');
          // Tailwind size-* is typically in rems (0.25rem = 4px)
          iconSize = sizeValue * 4;
        }
      }
      if (className?.includes("h-")) {
        const hMatch = className.match(/h-(\d+\.?\d*)/);
        if (hMatch) {
          iconSize = parseFloat(hMatch[1] ?? '0') * 4;
        }
      }
      if (className?.includes("w-")) {
        const wMatch = className.match(/w-(\d+\.?\d*)/);
        if (wMatch) {
          iconSize = parseFloat(wMatch[1] ?? '0') * 4;
        }
      }

      return (
        <span ref={ref} className={className}>
          <HugeiconsIcon
            icon={icon}
            size={iconSize}
            color={color || "currentColor"}
            strokeWidth={strokeWidth || 1.5}
          />
        </span>
      );
    }
  );
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