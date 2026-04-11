"use client";

import type { FileContent } from "@pidesk/shared";
import * as React from "react";
import {
  Binary,
  Check,
  FileIcon,
  FileText,
  FileWarning,
  Image,
  Loader2,
  Pencil,
  Terminal,
  X,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CodeLineViewer } from "./code-line-viewer";
import { Markdown } from "./markdown";
import { ScrollArea } from "./scroll-area";
import { Terminal as TerminalComponent } from "./terminal";

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
  onFileUpdated?: (path: string, content: string) => void;
  onTextSelect?: (selection: {
    text: string;
    startLine: number;
    endLine: number;
    filename: string;
    filePath: string;
  }) => void;
  className?: string;
  isTerminalOpen?: boolean;
  isTerminalActive?: boolean;
  onTerminalClick?: () => void;
  onTerminalClose?: () => void;
  terminalCwd?: string;
  terminalId?: string;
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
  const isImage = file.content?.type === "image";

  function getIcon(): React.ReactNode {
    if (isMarkdown) return <FileText className="size-5 shrink-0" />;
    if (isImage) return <Image className="size-5 shrink-0" />;
    return <FileIcon className="size-5 shrink-0" />;
  }

  return (
    <div
      onMouseDown={onClick}
      className={cn(
        "group relative flex h-9 min-w-0 max-w-[200px] shrink-0 cursor-pointer items-center gap-2 border-r border-white/[0.04] px-3",
        "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
        "hover:scale-[1.02] hover:-translate-y-[1px]",
        "motion-reduce:transform-none motion-reduce:transition-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary/50",
        isActive
          ? "bg-white/[0.06] text-white/80"
          : "bg-[var(--color-bg-primary)] text-white/50 hover:bg-white/[0.04] hover:text-white/70",
      )}
    >
      {isActive && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-[2px] bg-cyan-500",
            "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
          )}
        />
      )}
      {getIcon()}
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {fileName}
      </span>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded",
          "opacity-0 transition-all duration-150 [transition-timing-function:var(--ease-out)]",
          "hover:scale-110",
          "active:scale-[0.97] motion-reduce:active:scale-100",
          "focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/50",
          isActive
            ? "opacity-100 hover:bg-white/[0.08]"
            : "group-hover:opacity-100 hover:bg-white/[0.06]",
        )}
        aria-label={`Close ${fileName}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function TerminalTab({
  isActive,
  onClick,
  onClose,
}: {
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onClick}
      className={cn(
        "group relative flex h-9 min-w-0 max-w-[200px] shrink-0 cursor-pointer items-center gap-2 border-r border-white/[0.04] px-3",
        "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
        "hover:scale-[1.02] hover:-translate-y-[1px]",
        "motion-reduce:transform-none motion-reduce:transition-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary/50",
        isActive
          ? "bg-white/[0.06] text-white/80"
          : "bg-[var(--color-bg-primary)] text-white/50 hover:bg-white/[0.04] hover:text-white/70",
      )}
    >
      {isActive && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-[2px] bg-amber-500",
            "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
          )}
        />
      )}
      <Terminal className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        Terminal
      </span>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded",
          "opacity-0 transition-all duration-150 [transition-timing-function:var(--ease-out)]",
          "hover:scale-110",
          "active:scale-[0.97] motion-reduce:active:scale-100",
          "focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/50",
          isActive
            ? "opacity-100 hover:bg-white/[0.08]"
            : "group-hover:opacity-100 hover:bg-white/[0.06]",
        )}
        aria-label="Close terminal"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function EmptyState({ onCloseAll }: { onCloseAll?: () => void }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-4 p-8 text-center",
        "animate-in fade-in duration-300 [transition-timing-function:var(--ease-out)]",
      )}
    >
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04]",
          "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
          "hover:scale-[1.02] hover:-translate-y-[1px] hover:shadow-sm",
          "motion-reduce:transform-none motion-reduce:transition-none",
        )}
      >
        <FileText className="size-8 text-white/30" />
      </div>
      <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300 [transition-timing-function:var(--ease-out)]">
        <p className="text-sm font-medium text-white/50">No file open</p>
        <p className="text-xs text-white/30">
          Select a file from the tree to view it
        </p>
      </div>
      {onCloseAll && (
        <button
          type="button"
          onClick={onCloseAll}
          className={cn(
            "mt-2 rounded border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-xs text-white/50",
            "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
            "hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white/80 hover:shadow-sm",
            "hover:-translate-y-[1px]",
            "active:scale-[0.97] motion-reduce:active:scale-100",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50",
            "motion-reduce:transform-none motion-reduce:transition-none",
          )}
        >
          Close file viewer
        </button>
      )}
    </div>
  );
}

type SaveStatus = "idle" | "saving" | "success" | "error";

function FileContentViewer({
  file,
  filename,
  isEditing,
  onSave,
  onTextSelect,
}: {
  file: OpenFile;
  filename: string;
  isEditing: boolean;
  onSave: (content: string) => Promise<void>;
  onTextSelect?: (selection: {
    text: string;
    startLine: number;
    endLine: number;
    filename: string;
    filePath: string;
  }) => void;
}) {
  const language = getLanguageFromPath(file.path);
  const isMarkdown = isMarkdownFile(file.path);
  const [editContent, setEditContent] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isEditing && file.content?.type === "text" && file.content.content) {
      setEditContent(file.content.content);
      setSaveStatus("idle");
    }
  }, [isEditing, file.content]);

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  async function handleSave(): Promise<void> {
    setSaveStatus("saving");
    try {
      await onSave(editContent);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  if (file.isLoading) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-sm text-white/50",
          "animate-in fade-in duration-200 [transition-timing-function:var(--ease-out)]",
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-5 animate-spin rounded-full border-2 border-white/[0.08] border-t-primary",
              "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
            )}
          />
          Loading...
        </div>
      </div>
    );
  }

  if (file.error) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-sm text-red-400/80",
          "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
        )}
      >
        {file.error}
      </div>
    );
  }

  if (!file.content) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
          "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
        )}
      >
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04]",
            "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
            "hover:scale-[1.02] hover:-translate-y-[1px] hover:shadow-sm",
            "motion-reduce:transform-none motion-reduce:transition-none",
          )}
        >
          <FileIcon className="size-8 text-white/30" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/80">Empty file</p>
          <p className="text-xs text-white/40">This file has no content</p>
        </div>
      </div>
    );
  }

  if (file.content.type === "binary") {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
          "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
        )}
      >
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04]",
            "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
            "hover:scale-[1.02] hover:-translate-y-[1px] hover:shadow-sm",
            "motion-reduce:transform-none motion-reduce:transition-none",
          )}
        >
          <Binary className="size-8 text-white/30" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/80">Binary file</p>
          <p className="text-xs text-white/40">
            This file cannot be displayed in the text viewer
          </p>
        </div>
      </div>
    );
  }

  if (file.content.type === "unsupported") {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
          "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
        )}
      >
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04]",
            "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
            "hover:scale-[1.02] hover:-translate-y-[1px] hover:shadow-sm",
            "motion-reduce:transform-none motion-reduce:transition-none",
          )}
        >
          <FileWarning className="size-8 text-white/30" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/80">
            Unsupported file type
          </p>
          <p className="text-xs text-white/40">
            This file format cannot be displayed
          </p>
        </div>
      </div>
    );
  }

  if (file.content.type === "image" && file.content.content) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-8",
          "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
        )}
      >
        <img
          src={file.content.content}
          alt={getFileNameFromPath(file.path)}
          className={cn(
            "max-h-full max-w-full object-contain",
            "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
            "hover:scale-[1.02] hover:-translate-y-[1px]",
            "motion-reduce:transform-none motion-reduce:transition-none",
          )}
        />
      </div>
    );
  }

  if (file.content.type === "text") {
    const isTruncated = file.content.truncated;

    return (
      <div className="flex h-full flex-col">
        {isTruncated && (
          <div
            className={cn(
              "flex items-start gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm",
              "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
              "hover:bg-warning/15",
            )}
          >
            <FileWarning className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-warning-foreground">Large file</p>
              <p className="text-muted-foreground">
                This file exceeds 1MB and has been truncated. Showing first
                portion only.
                {isEditing && " Editing is disabled for truncated files."}
              </p>
            </div>
          </div>
        )}

        {isEditing && !isTruncated ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.04] bg-[var(--color-bg-secondary)] px-4 py-2">
              <span className="text-xs text-white/40">
                Editing mode (Cmd/Ctrl+S to save)
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === "saving"}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
                  "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                  "hover:scale-105 hover:-translate-y-[1px]",
                  "active:scale-[0.97] motion-reduce:active:scale-100",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50",
                  "motion-reduce:transform-none motion-reduce:transition-none",
                  saveStatus === "success" &&
                    "bg-success/10 text-success hover:bg-success/20",
                  saveStatus === "error" &&
                    "bg-destructive/10 text-destructive hover:bg-destructive/20",
                  saveStatus === "idle" &&
                    "bg-primary/10 text-primary hover:bg-primary/20",
                  saveStatus === "saving" && "cursor-not-allowed opacity-50",
                )}
              >
                {saveStatus === "saving" && (
                  <Loader2 className="size-3 animate-spin" />
                )}
                {saveStatus === "success" && <Check className="size-3" />}
                {saveStatus === "idle" && "Save"}
                {saveStatus === "saving" && "Saving..."}
                {saveStatus === "success" && "Saved"}
                {saveStatus === "error" && "Save failed"}
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex-1 resize-none bg-[var(--color-bg-primary)] p-4 font-mono text-sm text-white/80 outline-none",
                "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                "focus:bg-[var(--color-bg-secondary)] focus:ring-1 focus:ring-white/[0.08]",
              )}
              spellCheck={false}
            />
          </div>
        ) : isMarkdown && file.content.content ? (
          <div className="mx-auto max-w-3xl px-8 py-8">
            <article className="prose prose-zinc dark:prose-invert max-w-none">
              <Markdown>{file.content.content}</Markdown>
            </article>
          </div>
        ) : file.content.content ? (
          <CodeLineViewer
            code={file.content.content}
            language={language}
            filename={filename}
            filePath={file.path}
            onAddToChat={onTextSelect}
            className="min-h-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <FileIcon className="size-8 text-white/30" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/80">Empty file</p>
              <p className="text-xs text-white/40">This file has no content</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
      )}
    >
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-lg bg-white/[0.02] border border-white/[0.04]",
          "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
          "hover:scale-[1.02] hover:-translate-y-[1px] hover:shadow-sm",
          "motion-reduce:transform-none motion-reduce:transition-none",
        )}
      >
        <FileIcon className="size-8 text-white/30" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white/80">Empty file</p>
        <p className="text-xs text-white/40">This file has no content</p>
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
  onFileUpdated,
  onTextSelect,
  className,
  // Terminal tab props
  isTerminalOpen,
  isTerminalActive,
  onTerminalClick,
  onTerminalClose,
  terminalCwd,
  terminalId,
}: MultiFileViewerProps) {
  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const hasFiles = openFiles.length > 0;
  const [isEditing, setIsEditing] = React.useState(false);

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
  }, [checkScroll]);

  React.useEffect(() => {
    setIsEditing(false);
  }, []);

  function scrollTabs(direction: "left" | "right"): void {
    const el = tabsRef.current;
    if (!el) return;
    const scrollAmount = 150;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }

  const canEdit =
    activeFile?.content?.type === "text" && !activeFile.content.truncated;

  async function handleSave(content: string): Promise<void> {
    if (!activeFile) return;
    await window.pidesk.fs.writeFile(activeFile.path, content);
    onFileUpdated?.(activeFile.path, content);
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {(hasFiles || isTerminalOpen) && (
        <div className="flex h-10 shrink-0 items-center border-b border-white/[0.04] bg-[var(--color-bg-primary)]">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollTabs("left")}
              className={cn(
                "flex h-full w-6 shrink-0 items-center justify-center border-r border-white/[0.04] bg-[var(--color-bg-primary)] text-white/30",
                "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                "hover:bg-white/[0.04] hover:text-white/80",
                "hover:scale-105 hover:-translate-y-[1px]",
                "active:scale-[0.97] motion-reduce:active:scale-100",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50",
              )}
            >
              <svg
                className="size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label="Scroll left"
              >
                <title>Scroll left</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          <div
            ref={tabsRef}
            className="flex min-w-0 flex-1 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {openFiles.map((file) => (
              <FileTab
                key={file.path}
                file={file}
                isActive={file.path === activeFilePath && !isTerminalActive}
                onClick={() => onTabClick(file.path)}
                onClose={(e) => {
                  e.stopPropagation();
                  onTabClose(file.path);
                }}
              />
            ))}
            {isTerminalOpen && (
              <TerminalTab
                isActive={isTerminalActive ?? false}
                onClick={() => onTerminalClick?.()}
                onClose={(e) => {
                  e.stopPropagation();
                  onTerminalClose?.();
                }}
              />
            )}
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollTabs("right")}
              className={cn(
                "flex h-full w-6 shrink-0 items-center justify-center border-l border-white/[0.04] bg-[var(--color-bg-primary)] text-white/30",
                "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                "hover:bg-white/[0.04] hover:text-white/80",
                "hover:scale-105 hover:-translate-y-[1px]",
                "active:scale-[0.97] motion-reduce:active:scale-100",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50",
              )}
            >
              <svg
                className="size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label="Scroll right"
              >
                <title>Scroll right</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}

          <div className="flex shrink-0 items-center border-l border-white/[0.04] bg-[var(--color-bg-primary)] px-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "flex size-6 items-center justify-center rounded",
                  "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                  "hover:scale-105 hover:-translate-y-[1px]",
                  "active:scale-[0.97] motion-reduce:active:scale-100",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50",
                  isEditing
                    ? "bg-primary/10 text-primary"
                    : "text-white/30 hover:bg-white/[0.06] hover:text-white/80",
                )}
                aria-label={isEditing ? "Exit edit mode" : "Edit file"}
              >
                <Pencil className="size-5" />
              </button>
            )}
            {onOpenTerminal && (
              <button
                type="button"
                onClick={onOpenTerminal}
                className={cn(
                  "flex size-6 items-center justify-center rounded",
                  "text-white/30",
                  "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                  "hover:bg-white/[0.06] hover:text-white/80",
                  "hover:scale-105 hover:-translate-y-[1px]",
                  "active:scale-[0.97] motion-reduce:active:scale-100",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50",
                )}
                aria-label="Open terminal"
              >
                <Terminal className="size-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onCloseAll}
              className={cn(
                "flex size-6 items-center justify-center rounded",
                "text-white/30",
                "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                "hover:bg-white/[0.06] hover:text-white/80",
                "hover:scale-105 hover:-translate-y-[1px]",
                "active:scale-[0.97] motion-reduce:active:scale-100",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50",
              )}
              aria-label="Close all files"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
        {isTerminalActive ? (
          <TerminalComponent
            id={terminalId ?? "terminal"}
            cwd={terminalCwd}
            className="h-full"
          />
        ) : activeFile ? (
          <ScrollArea className="h-full">
            <FileContentViewer
              file={activeFile}
              filename={getFileNameFromPath(activeFile.path)}
              isEditing={isEditing && canEdit}
              onSave={handleSave}
              onTextSelect={onTextSelect}
            />
          </ScrollArea>
        ) : (
          <EmptyState onCloseAll={onCloseAll} />
        )}
      </div>
    </div>
  );
}
