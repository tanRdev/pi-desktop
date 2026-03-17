/**
 * File window content - renders file contents in a window.
 */

import type { FileContent } from "@pidesk/shared";
import { Save, Loader2, File, FileText, Image } from "@/components/ui/icons";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeEditor } from "../ui/code-editor";
import { Markdown } from "../ui/markdown";
import { ScrollArea } from "../ui/scroll-area";

/**
 * Extension to language mapping for syntax highlighting.
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
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
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".ps1": "powershell",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "scss",
  ".less": "less",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".svg": "xml",
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
  ".dockerfile": "dockerfile",
  ".makefile": "makefile",
  ".mk": "makefile",
  ".nix": "nix",
  ".prisma": "prisma",
  ".graphql": "graphql",
  ".gql": "graphql",
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

function isImageFile(path: string): boolean {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = path.slice(lastDot).toLowerCase();
  return [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".ico",
  ].includes(ext);
}

function getFileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/**
 * Props for FileWindowContent component.
 */
export interface FileWindowContentProps {
  /** File path */
  filePath: string;
  /** File content (may be loading) */
  content: FileContent | null;
  /** Whether the file is loading */
  isLoading?: boolean;
  /** Error message if load failed */
  error?: string | null;
  /** Whether the file is dirty (has unsaved changes) */
  isDirty?: boolean;
  /** Whether the file is read-only */
  isReadOnly?: boolean;
  /** Called when content is edited */
  onContentChange?: (content: string) => void;
  /** Called when file is saved */
  onSave?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * File window content component.
 */
export function FileWindowContent({
  filePath,
  content,
  isLoading,
  error,
  isDirty,
  isReadOnly = false,
  onContentChange,
  onSave,
  className,
}: FileWindowContentProps) {
  const fileName = getFileNameFromPath(filePath);
  const isMarkdown = isMarkdownFile(filePath);

  // Track local content for editing
  const [localContent, setLocalContent] = React.useState<string | null>(null);

  // Sync local content with prop when it changes
  React.useEffect(() => {
    if (content?.type === "text") {
      setLocalContent(content.content);
    }
  }, [content]);

  // Handle content change
  const handleContentChange = React.useCallback(
    (newContent: string) => {
      setLocalContent(newContent);
      onContentChange?.(newContent);
    },
    [onContentChange],
  );

  const renderEditorToolbar = () =>
    onSave ? (
      <div className="flex h-10 shrink-0 items-center justify-end border-b border-border bg-surface-2 px-3">
        <button
          type="button"
          onClick={onSave}
          disabled={isReadOnly || !isDirty}
          className="flex h-7 items-center gap-1 rounded border border-border px-2 text-xs text-foreground transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          Save
        </button>
      </div>
    ) : null;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Loading {fileName}...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-destructive">
          <File className="h-8 w-8" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // No content
  if (!content) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <File className="h-8 w-8" />
          <span className="text-sm">No content</span>
        </div>
      </div>
    );
  }

  // Binary file
  if (content.type === "binary") {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <File className="h-8 w-8" />
          <span className="text-sm">Binary file - cannot display</span>
          <span className="text-xs text-muted-foreground">
            {content.size ?? 0} bytes
          </span>
        </div>
      </div>
    );
  }

  // Unsupported file type
  if (content.type === "unsupported") {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <File className="h-8 w-8" />
          <span className="text-sm">Unsupported file type</span>
        </div>
      </div>
    );
  }

  // Image file
  if (content.type === "image") {
    const imageSrc = content.content.startsWith("data:")
      ? content.content
      : `data:${content.mimeType ?? "image/png"};base64,${content.content}`;
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center bg-black/5 p-4",
          className,
        )}
      >
        <img
          src={imageSrc}
          alt={fileName}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  // Text file
  if (content.type === "text") {
    // Markdown - render with markdown viewer (read-only for now)
    if (isMarkdown) {
      return (
        <div className={cn("flex h-full flex-col", className)}>
          {renderEditorToolbar()}
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <Markdown>{localContent ?? content.content}</Markdown>
            </div>
          </ScrollArea>
        </div>
      );
    }

    // Code - render with Monaco editor
    return (
      <div className={cn("flex h-full flex-col", className)}>
        {renderEditorToolbar()}
        <div className="min-h-0 flex-1">
          <CodeEditor
            filePath={filePath}
            value={localContent ?? content.content}
            language={getLanguageFromPath(filePath)}
            readOnly={isReadOnly}
            onChange={handleContentChange}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  // Unknown type
  return (
    <div className={cn("flex h-full items-center justify-center", className)}>
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <File className="h-8 w-8" />
        <span className="text-sm">Unknown file type</span>
      </div>
    </div>
  );
}

/**
 * Get the icon for a file based on its path.
 */
export function getFileIcon(path: string, className?: string) {
  if (isMarkdownFile(path)) {
    return <FileText className={cn("size-4", className)} />;
  }
  if (isImageFile(path)) {
    return <Image className={cn("size-4", className)} />;
  }
  return <File className={cn("size-4", className)} />;
}
