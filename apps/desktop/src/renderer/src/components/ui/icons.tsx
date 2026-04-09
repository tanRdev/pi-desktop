/**
 * Icon wrapper using Phosphor Icons
 * All icons are from @phosphor-icons/react
 */

import * as React from "react";

// ============================================
// CUSTOM ICONS
// ============================================

/** Pi symbol icon - Math constant π */
export function Pi({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <title>Pi</title>
      <path d="M200 64H56V48a8 8 0 0 0-16 0v16H32a8 8 0 0 0 0 16h8v112a8 8 0 0 0 16 0V80h60v112a8 8 0 0 0 16 0V80h52v96a8 8 0 0 0 16 0V80h8a8 8 0 0 0 0-16Z" />
    </svg>
  );
}

import {
  Archive,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  At,
  BracketsAngle,
  Calendar,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Chat,
  ChatCentered,
  ChatCenteredText,
  ChatText,
  Check,
  CheckCircle,
  Circle,
  CircleNotch,
  ClockCounterClockwise,
  Code,
  Command,
  Copy,
  CornersOut,
  Cpu,
  Database,
  Desktop,
  DotsThree,
  DownloadSimple,
  EnvelopeSimple,
  Export,
  Faders,
  File,
  FileCode,
  FileText,
  FileX,
  FloppyDisk,
  Folder,
  FolderOpen,
  FolderPlus,
  Folders,
  Gear,
  GearSix,
  GitBranch,
  Globe,
  type IconProps,
  Image,
  Info,
  Keyboard,
  Layout,
  Link,
  List,
  Lock,
  MagnifyingGlass,
  Microphone,
  Minus,
  MinusCircle,
  NavigationArrow,
  Package,
  PaintBrush,
  Paperclip,
  PencilSimple,
  Phone,
  Plus,
  PlusCircle,
  PlayCircle,
  CircleDashed,
  Pulse,
  Queue,
  Robot,
  Shield,
  SidebarSimple,
  SignOut,
  Spinner,
  Square,
  SquaresFour,
  Stack,
  Star,
  Stop,
  Swatches,
  Terminal,
  TerminalWindow,
  TextAa,
  ThumbsDown,
  ThumbsUp,
  Trash,
  TreeStructure,
  UploadSimple,
  User,
  Warning,
  WarningCircle,
  WarningOctagon,
  WifiSlash,
  Wrench,
  X,
  XCircle,
} from "@phosphor-icons/react";

// Re-export all icons
export {
  Archive,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  At,
  BracketsAngle,
  Calendar,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  Chat,
  ChatCentered,
  ChatCenteredText,
  ChatText,
  Check,
  CheckCircle,
  Circle,
  CircleNotch,
  ClockCounterClockwise,
  Code,
  Command,
  Copy,
  CornersOut,
  Cpu,
  Database,
  Desktop,
  DotsThree,
  DownloadSimple,
  EnvelopeSimple,
  Export,
  Faders,
  File,
  FileCode,
  FileText,
  FileX,
  FloppyDisk,
  Folder,
  FolderOpen,
  FolderPlus,
  Folders,
  Gear,
  GearSix,
  GitBranch,
  Globe,
  Image,
  Info,
  Keyboard,
  Layout,
  Link,
  List,
  Lock,
  MagnifyingGlass,
  Microphone,
  Minus,
  MinusCircle,
  NavigationArrow,
  Package,
  PaintBrush,
  SquaresFour,
  Paperclip,
  PencilSimple,
  Phone,
  Plus,
  PlusCircle,
  PlayCircle,
  CircleDashed,
  Pulse,
  Queue,
  Robot,
  Shield,
  SidebarSimple,
  SignOut,
  Spinner,
  Square,
  Stack,
  Star,
  Stop,
  Swatches,
  Terminal,
  TerminalWindow,
  TextAa,
  ThumbsDown,
  ThumbsUp,
  Trash,
  TreeStructure,
  UploadSimple,
  User,
  Warning,
  WarningCircle,
  WarningOctagon,
  WifiSlash,
  Wrench,
  X,
  XCircle,
  type IconProps,
};

// ============================================
// ICON SIZE UTILITIES - Standardized sizing
// Use these with className for consistency
// ============================================

/** 12px - Extra small: inline text, compact lists, status indicators */
export const ICON_SIZE_XS = "size-3";

/** 14px - Small: buttons, navigation items, chips */
export const ICON_SIZE_SM = "size-3.5";

/** 16px - Medium: standard UI elements, toolbars (default) */
export const ICON_SIZE_MD = "size-4";

/** 20px - Large: featured icons, empty states, prominent actions */
export const ICON_SIZE_LG = "size-5";

/** 24px - Extra large: hero sections, onboarding, major actions */
export const ICON_SIZE_XL = "size-6";

// Common aliases to match previous icon names
export { ChatText as MessageSquare };
export { ChatCenteredText as MessageCircle };
export { CircleNotch as Loader2 };
export { FolderOpen as FolderTree };
export { Phone as MobileDevice };
export { Spinner as Loader };
export { ArrowCounterClockwise as RotateCcw };
export { ArrowCounterClockwise as RotateCounterClockwise };
export { ArrowClockwise as RefreshCw };
export { CaretDown as ChevronDown };
export { CaretLeft as ChevronLeft };
export { CaretRight as ChevronRight };
export { CaretUp as ChevronUp };
export { EnvelopeSimple as Mail };
export { MagnifyingGlass as Search };
export { DotsThree as MoreHorizontal };
export { TreeStructure as GitCommit };
export { BracketsAngle as Code2 };
export { FileCode as FileJson };
export { XCircle as CloseCircle };
export { Minus as MinusIcon };
export { Plus as PlusIcon };
export { Trash as Delete };
export { CornersOut as Maximize2 };
export { Export as ExternalLink };
export { Calendar as CalendarDays };
export { Stack as Layers2 };
export { ChatCentered as StickyNote };
export { Gear as Settings };
export { GearSix as Settings2 };
export { TextAa as Type };
export { PencilSimple as Pencil };
export { X as Close };
export { Queue as ListOrdered };
export { Star as Sparkles };
export { Robot as Bot };
export { TerminalWindow as ComputerTerminal };
export { Cpu as CpuIcon };
export { Database as DatabaseIcon };
export { Desktop as Monitor };
export { Desktop as Computer };
export { Globe as GlobeIcon };
export { Layout as LayoutGrid };
export { Lock as ShieldLock };
export { Warning as AlertTriangle };
export { WarningCircle as AlertCircle };
export { CheckCircle as CheckmarkCircle };
export { ArrowUp as ArrowUpIcon };
export { ArrowDown as ArrowDownIcon };
export { ArrowLeft as ArrowLeftIcon };
export { ArrowRight as ArrowRightIcon };
export { Keyboard as KeyboardIcon };
export { Image as ImageIcon };
export { Paperclip as PaperclipIcon };
export { FileText as FileTextIcon };
export { File as FileIcon };
export { FileX as FileWarning };
export { FolderPlus as FolderPlusIcon };
export { Folders as FolderGit };
export { Folder as FolderIcon };
export { GitBranch as GitBranchIcon };
export { UploadSimple as Upload };
export { DownloadSimple as Download };
export { User as UserIcon };
export { At as AtSign };
export { Link as Link2 };
export { List as ListIcon };
export { Command as CommandIcon };
export { Wrench as WrenchIcon };
export { Pulse as Activity };
export { Pulse as ActivityIcon };
export { Info as InfoIcon };
export { WarningOctagon as AlertOctagon };
export { Swatches as Palette };
export { FloppyDisk as Save };
export { BracketsAngle as Binary };
export { Package as Box };
export { Stack as Layers };

// Additional aliases for new icons
export { Square as SquareIcon };
export { Square as StopIcon };
export { WifiSlash as WifiOff };
export { SignOut as LogOut };
export { SignOut as LogOutIcon };
