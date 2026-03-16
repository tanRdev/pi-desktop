"use client";

import type { FileContent } from "@pidesk/shared";
import { Binary, FileIcon, FileText, FileWarning, Terminal, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeBlockCode } from "./code-block";
import { Markdown } from "./markdown";
import { ScrollArea } from "./scroll-area";

// Map file extensions to language identifiers for syntax highlighting
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "jsx",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".ps1": "powershell",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".svg": "svg",
  ".sql": "sql",
  ".md": "markdown",
  ".markdown": "markdown",
  ".php": "php",
  ".vue": "vue",
  ".svelte": "svelte",
  ".lua": "lua",
  ".r": "r",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
  ".hs": "haskell",
  ".jl": "julia",
  ".pl": "perl",
  ".scala": "scala",
  ".clj": "clojure",
  ".erl": "erlang",
  ".f": "fortran",
  ".f90": "fortran",
  ".groovy": "groovy",
  ".m": "objc",
  ".mm": "objc",
  ".vim": "vim",
  ".nix": "nix",
  ".prisma": "prisma",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".dockerfile": "dockerfile",
  ".makefile": "makefile",
  ".mk": "makefile",
};

function getLanguageFromPath(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return "plaintext";
  const ext = path.slice(lastDot).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? "plaintext";
}

function isMarkdownFile(path: string): boolean {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = path.slice(lastDot).toLowerCase();
  return ext === ".md" || ext === ".markdown";
}

function getFileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export interface OpenFile {
  path: string;
  content: FileContent | null;
  isLoading: boolean;
  error: string | null;
}

export interface MultiFileViewerProps {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onCloseAll?: () => void;
  onOpenTerminal?: () => void;
  className?: string;
}

function FileTab({
  file,
  isActive,
  onClick,
  onClose,
}: {
  file: OpenFile;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const fileName = getFileNameFromPath(file.path);
  const isMarkdown = isMarkdownFile(file.path);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
        }
      }}
      className={cn(
        "group relative flex h-9 min-w-0 max-w-[200px] shrink-0 cursor-pointer items-center gap-2 border-r border-border px-3 transition-all",
        isActive
          ? "bg-surface-2 text-foreground"
          : "bg-surface-1 text-muted-foreground hover:bg-surface-2/50 hover:text-foreground/80",
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-primary" />
      )}

      {/* File icon */}
      {isMarkdown ? (
        <FileText className="size-3.5 shrink-0" />
      ) : (
        <FileIcon className="size-3.5 shrink-0" />
      )}

      {/* File name */}
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {fileName}
      </span>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition",
          isActive
            ? "opacity-100 hover:bg-surface-3"
            : "group-hover:opacity-100 hover:bg-surface-2",
        )}
        aria-label={`Close ${fileName}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function EmptyState({ onCloseAll }: { onCloseAll?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2">
        <FileText className="size-8 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">
          No file open
        </p>
        <p className="text-xs text-muted-foreground/70">
          Select a file from the tree to view it
        </p>
      </div>
      {onCloseAll && (
        <button
          type="button"
          onClick={onCloseAll}
          className="mt-2 rounded border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-border-hover hover:bg-surface-3 hover:text-foreground"
        >
          Close file viewer
        </button>
      )}
    </div>
  );
}

function FileContentViewer({ file }: { file: OpenFile }) {
  const fileName = getFileNameFromPath(file.path);
  const language = getLanguageFromPath(file.path);
  const isMarkdown = isMarkdownFile(file.path);

  if (file.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
          Loading...
        </div>
      </div>
    );
  }

  if (file.error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {file.error}
      </div>
    );
  }

  if (!file.content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2">
          <FileIcon className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Empty file</p>
          <p className="text-xs text-muted-foreground">
            This file has no content
          </p>
        </div>
      </div>
    );
  }

  if (file.content.type === "binary") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2">
          <Binary className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Binary file</p>
          <p className="text-xs text-muted-foreground">
            This file cannot be displayed in the text viewer
          </p>
        </div>
      </div>
    );
  }

  if (file.content.type === "unsupported") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2">
          <FileWarning className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Unsupported file type
          </p>
          <p className="text-xs text-muted-foreground">
            This file format cannot be displayed
          </p>
        </div>
      </div>
    );
  }

  if (file.content.type === "text" && file.content.content) {
    return (
      <div className="h-full">
        {file.content.truncated && (
          <div className="flex items-start gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-warning-foreground">Large file</p>
              <p className="text-muted-foreground">
                This file exceeds 1MB and has been truncated. Showing first
                portion only.
              </p>
            </div>
          </div>
        )}

        {isMarkdown ? (
          <div className="mx-auto max-w-3xl px-8 py-8">
            <article className="prose prose-zinc dark:prose-invert max-w-none">
              <Markdown>{file.content.content}</Markdown>
            </article>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            <CodeBlockCode
              code={file.content.content}
              language={language}
              className="min-h-full"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2">
        <FileIcon className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Empty file</p>
        <p className="text-xs text-muted-foreground">
          This file has no content
        </p>
      </div>
    </div>
  );
}

export function MultiFileViewer({
  openFiles,
  activeFilePath,
  onTabClick,
  onTabClose,
  onCloseAll,
  onOpenTerminal,
  className,
}: MultiFileViewerProps) {
  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const hasFiles = openFiles.length > 0;

  // Handle scrollable tabs
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, openFiles.length]);

  const scrollTabs = (direction: "left" | "right") => {
    const el = tabsRef.current;
    if (!el) return;
    const scrollAmount = 150;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Tab bar */}
      {hasFiles && (
        <div className="flex h-10 shrink-0 items-center border-b border-border bg-surface-1">
          {/* Scroll left button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollTabs("left")}
              className="flex h-full w-6 shrink-0 items-center justify-center border-r border-border bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <svg
                className="size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Tabs container */}
          <div
            ref={tabsRef}
            className="flex min-w-0 flex-1 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {openFiles.map((file) => (
              <FileTab
                key={file.path}
                file={file}
                isActive={file.path === activeFilePath}
                onClick={() => onTabClick(file.path)}
                onClose={(e) => {
                  e.stopPropagation();
                  onTabClose(file.path);
                }}
              />
            ))}
          </div>

          {/* Scroll right button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollTabs("right")}
              className="flex h-full w-6 shrink-0 items-center justify-center border-l border-border bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <svg
                className="size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}

          {/* Actions */}
          <div className="flex shrink-0 items-center border-l border-border bg-surface-1 px-2">
            {onOpenTerminal && (
              <button
                type="button"
                onClick={onOpenTerminal}
                className="flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                aria-label="Open terminal"
              >
                <Terminal className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onCloseAll}
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              aria-label="Close all files"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-hidden bg-background">
        {activeFile ? (
          <ScrollArea className="h-full">
            <FileContentViewer file={activeFile} />
          </ScrollArea>
        ) : (
          <EmptyState onCloseAll={onCloseAll} />
        )}
      </div>
    </div>
  );
}
