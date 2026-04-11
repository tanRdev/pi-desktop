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
      viewBox="0 0 1024 1024"
      fill="none"
      className={className}
    >
      <title>Pi</title>
      <rect
        width="1024"
        height="1024"
        rx="224"
        fill="var(--color-bg-primary)"
      />
      <rect
        x="1"
        y="1"
        width="1022"
        height="1022"
        rx="223"
        stroke="white"
        strokeOpacity="0.08"
        strokeWidth="2"
      />
      <g transform="translate(512, 512) scale(2.8) translate(-128, -128)">
        <path
          d="M201.54,54.46A104,104,0,0,0,54.46,201.54,104,104,0,0,0,201.54,54.46ZM190.23,65.78a88.18,88.18,0,0,1,11,13.48L167.55,119,139.63,40.78A87.34,87.34,0,0,1,190.23,65.78ZM155.59,133l-18.16,21.37-27.59-5L100.41,123l18.16-21.37,27.59,5ZM65.77,65.78a87.34,87.34,0,0,1,56.66-25.59l17.51,49L58.3,74.32A88,88,0,0,1,65.77,65.78ZM46.65,161.54a88.41,88.41,0,0,1,2.53-72.62l51.21,9.35Zm19.12,28.68a88.18,88.18,0,0,1-11-13.48L88.45,137l27.92,78.18A87.34,87.34,0,0,1,65.77,190.22Zm124.46,0a87.34,87.34,0,0,1-56.66,25.59l-17.51-49,81.64,14.91A88,88,0,0,1,190.23,190.22Zm-34.62-32.49,53.74-63.27a88.41,88.41,0,0,1-2.53,72.62Z"
          fill="#d1d1d1"
        />
      </g>
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
  CircleDashed,
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
  PlayCircle,
  Plus,
  PlusCircle,
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
export const ICON_SIZE_SM = "size-5";

/** 20px - Medium: standard UI elements, toolbars (default per cheatsheet) */
export const ICON_SIZE_MD = "size-5";

/** 24px - Large: featured icons, empty states, prominent actions */
export const ICON_SIZE_LG = "size-6";

/** 32px - Extra large: hero sections, onboarding, major actions */
export const ICON_SIZE_XL = "size-8";

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
