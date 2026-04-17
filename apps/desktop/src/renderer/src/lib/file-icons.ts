/**
 * File icon + color mapping for the workspace file tree.
 *
 * Resolution order:
 *   1. Exact filename override (Dockerfile, LICENSE, package.json, etc.)
 *   2. Pattern overrides (.eslintrc*, tsconfig*.json)
 *   3. Extension map (.ts, .css, .py, ...)
 *   4. Default fallback (File)
 *
 * Colors are intentionally muted — bright enough to hint at the file kind
 * without competing with the folder accent state. Tints come from Tailwind
 * palette tokens at ~50% opacity so they read as subtle highlights on the
 * dark sidebar surface.
 */

import {
  BookOpen,
  File,
  FileAudio,
  FileCode,
  FileCss,
  FileHtml,
  FileJs,
  FileJsx,
  FileLock,
  FileMd,
  FilePdf,
  FilePy,
  FileRs,
  FileSvg,
  FileTs,
  FileTsx,
  FileVideo,
  FileZip,
  Gear,
  GitBranch,
  type IconProps,
  Image,
  Lock,
  Package,
  Scales,
} from "@phosphor-icons/react";
import type * as React from "react";

export type FileIconComponent = React.ComponentType<IconProps>;

export interface FileIcon {
  Icon: FileIconComponent;
  /** Tailwind class that sets the icon color. Muted on purpose. */
  colorClassName: string;
}

const DEFAULT_COLOR = "text-white/50";

const ICON_DEFAULT: FileIcon = { Icon: File, colorClassName: DEFAULT_COLOR };

// ---------------------------------------------------------------------------
// Filename overrides — matched BEFORE extension lookup.
// Keys are normalized to lowercase for comparison.
// ---------------------------------------------------------------------------
const FILENAME_OVERRIDES: Record<string, FileIcon> = {
  dockerfile: { Icon: Gear, colorClassName: "text-sky-400/60" },
  makefile: { Icon: Gear, colorClassName: "text-orange-400/60" },
  license: { Icon: Scales, colorClassName: "text-white/60" },
  "license.md": { Icon: Scales, colorClassName: "text-white/60" },
  readme: { Icon: BookOpen, colorClassName: "text-white/70" },
  "readme.md": { Icon: BookOpen, colorClassName: "text-white/70" },
  ".env": { Icon: Lock, colorClassName: "text-yellow-400/60" },
  ".env.local": { Icon: Lock, colorClassName: "text-yellow-400/60" },
  ".env.production": { Icon: Lock, colorClassName: "text-yellow-400/60" },
  ".env.development": { Icon: Lock, colorClassName: "text-yellow-400/60" },
  ".env.test": { Icon: Lock, colorClassName: "text-yellow-400/60" },
  ".gitignore": { Icon: GitBranch, colorClassName: "text-orange-400/60" },
  ".gitattributes": { Icon: GitBranch, colorClassName: "text-orange-400/60" },
  ".editorconfig": { Icon: Gear, colorClassName: "text-white/50" },
  ".prettierrc": { Icon: Gear, colorClassName: "text-pink-400/60" },
  ".prettierrc.json": { Icon: Gear, colorClassName: "text-pink-400/60" },
  ".prettierrc.js": { Icon: Gear, colorClassName: "text-pink-400/60" },
  ".prettierrc.cjs": { Icon: Gear, colorClassName: "text-pink-400/60" },
  "package.json": { Icon: Package, colorClassName: "text-red-400/60" },
  "package-lock.json": { Icon: FileLock, colorClassName: "text-red-400/50" },
  "bun.lock": { Icon: FileLock, colorClassName: "text-amber-400/60" },
  "bun.lockb": { Icon: FileLock, colorClassName: "text-amber-400/60" },
  "pnpm-lock.yaml": { Icon: FileLock, colorClassName: "text-amber-400/60" },
  "yarn.lock": { Icon: FileLock, colorClassName: "text-amber-400/60" },
};

// Prefix-based matches for glob-like filenames (.eslintrc*, tsconfig*.json).
// Each entry is evaluated in order; the first hit wins.
const FILENAME_PREFIX_OVERRIDES: Array<{
  test: (name: string) => boolean;
  icon: FileIcon;
}> = [
  {
    test: (name) => name.startsWith(".eslintrc"),
    icon: { Icon: Gear, colorClassName: "text-indigo-400/60" },
  },
  {
    test: (name) => name.startsWith("tsconfig") && name.endsWith(".json"),
    icon: { Icon: Gear, colorClassName: "text-blue-400/60" },
  },
  {
    test: (name) => name.startsWith(".babelrc"),
    icon: { Icon: Gear, colorClassName: "text-yellow-400/60" },
  },
];

// ---------------------------------------------------------------------------
// Extension map — keys are lowercase including the leading dot.
// ---------------------------------------------------------------------------
const EXTENSION_MAP: Record<string, FileIcon> = {
  ".ts": { Icon: FileTs, colorClassName: "text-blue-400/70" },
  ".tsx": { Icon: FileTsx, colorClassName: "text-blue-400/70" },
  ".mts": { Icon: FileTs, colorClassName: "text-blue-400/70" },
  ".cts": { Icon: FileTs, colorClassName: "text-blue-400/70" },

  ".js": { Icon: FileJs, colorClassName: "text-yellow-400/70" },
  ".jsx": { Icon: FileJsx, colorClassName: "text-yellow-400/70" },
  ".mjs": { Icon: FileJs, colorClassName: "text-yellow-400/70" },
  ".cjs": { Icon: FileJs, colorClassName: "text-yellow-400/70" },

  ".md": { Icon: FileMd, colorClassName: "text-white/60" },
  ".mdx": { Icon: FileMd, colorClassName: "text-white/60" },

  ".html": { Icon: FileHtml, colorClassName: "text-orange-400/70" },
  ".htm": { Icon: FileHtml, colorClassName: "text-orange-400/70" },

  ".css": { Icon: FileCss, colorClassName: "text-pink-400/60" },
  ".scss": { Icon: FileCss, colorClassName: "text-pink-400/60" },
  ".sass": { Icon: FileCss, colorClassName: "text-pink-400/60" },
  ".less": { Icon: FileCss, colorClassName: "text-pink-400/60" },

  ".svg": { Icon: FileSvg, colorClassName: "text-amber-400/60" },

  ".py": { Icon: FilePy, colorClassName: "text-sky-400/60" },
  ".rs": { Icon: FileRs, colorClassName: "text-orange-400/60" },

  ".lock": { Icon: FileLock, colorClassName: "text-amber-400/60" },

  ".zip": { Icon: FileZip, colorClassName: "text-white/50" },
  ".tar": { Icon: FileZip, colorClassName: "text-white/50" },
  ".gz": { Icon: FileZip, colorClassName: "text-white/50" },
  ".tgz": { Icon: FileZip, colorClassName: "text-white/50" },

  ".pdf": { Icon: FilePdf, colorClassName: "text-red-400/70" },

  ".mp4": { Icon: FileVideo, colorClassName: "text-purple-400/60" },
  ".mov": { Icon: FileVideo, colorClassName: "text-purple-400/60" },
  ".webm": { Icon: FileVideo, colorClassName: "text-purple-400/60" },
  ".mkv": { Icon: FileVideo, colorClassName: "text-purple-400/60" },

  ".mp3": { Icon: FileAudio, colorClassName: "text-purple-400/60" },
  ".wav": { Icon: FileAudio, colorClassName: "text-purple-400/60" },
  ".flac": { Icon: FileAudio, colorClassName: "text-purple-400/60" },

  ".json": { Icon: FileCode, colorClassName: "text-yellow-400/60" },
  ".jsonc": { Icon: FileCode, colorClassName: "text-yellow-400/60" },
  ".json5": { Icon: FileCode, colorClassName: "text-yellow-400/60" },

  ".yml": { Icon: FileCode, colorClassName: "text-pink-400/60" },
  ".yaml": { Icon: FileCode, colorClassName: "text-pink-400/60" },

  ".toml": { Icon: FileCode, colorClassName: "text-orange-300/60" },
  ".ini": { Icon: FileCode, colorClassName: "text-white/50" },

  // Generic code languages without dedicated Phosphor glyphs.
  ".go": { Icon: FileCode, colorClassName: "text-cyan-400/60" },
  ".rb": { Icon: FileCode, colorClassName: "text-red-400/60" },
  ".java": { Icon: FileCode, colorClassName: "text-orange-400/60" },
  ".kt": { Icon: FileCode, colorClassName: "text-orange-400/60" },
  ".swift": { Icon: FileCode, colorClassName: "text-orange-400/60" },
  ".c": { Icon: FileCode, colorClassName: "text-sky-400/60" },
  ".cpp": { Icon: FileCode, colorClassName: "text-sky-400/60" },
  ".cc": { Icon: FileCode, colorClassName: "text-sky-400/60" },
  ".h": { Icon: FileCode, colorClassName: "text-sky-400/60" },
  ".hpp": { Icon: FileCode, colorClassName: "text-sky-400/60" },
  ".sh": { Icon: FileCode, colorClassName: "text-cyan-400/60" },
  ".bash": { Icon: FileCode, colorClassName: "text-cyan-400/60" },
  ".zsh": { Icon: FileCode, colorClassName: "text-cyan-400/60" },
  ".fish": { Icon: FileCode, colorClassName: "text-cyan-400/60" },
  ".vue": { Icon: FileCode, colorClassName: "text-teal-400/60" },

  // Images handled as a group (Phosphor `Image`).
  ".png": { Icon: Image, colorClassName: "text-violet-400/60" },
  ".jpg": { Icon: Image, colorClassName: "text-violet-400/60" },
  ".jpeg": { Icon: Image, colorClassName: "text-violet-400/60" },
  ".gif": { Icon: Image, colorClassName: "text-violet-400/60" },
  ".webp": { Icon: Image, colorClassName: "text-violet-400/60" },
  ".avif": { Icon: Image, colorClassName: "text-violet-400/60" },
  ".ico": { Icon: Image, colorClassName: "text-violet-400/60" },
};

/**
 * Resolve a file icon + muted color class for a filename + optional extension.
 *
 * @param filename  Basename of the file (e.g. `package.json`, `README.md`).
 * @param extension Extension WITHOUT a leading dot (`"ts"`, `"json"`), or
 *                  `null` when the file has no extension. Caller-provided so
 *                  we do not re-parse what the FS watcher already parsed.
 */
export function getFileIconByExtension(
  filename: string,
  extension: string | null,
): FileIcon {
  const lowerName = filename.toLowerCase();

  const exactOverride = FILENAME_OVERRIDES[lowerName];
  if (exactOverride) return exactOverride;

  for (const { test, icon } of FILENAME_PREFIX_OVERRIDES) {
    if (test(lowerName)) return icon;
  }

  if (extension) {
    const key = `.${extension.toLowerCase()}`;
    const match = EXTENSION_MAP[key];
    if (match) return match;
  }

  return ICON_DEFAULT;
}

export const __testing = {
  FILENAME_OVERRIDES,
  EXTENSION_MAP,
  ICON_DEFAULT,
};
