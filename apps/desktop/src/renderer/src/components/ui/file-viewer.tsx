import type { FileContent } from "@pidesk/shared";
import { Binary, FileIcon, FileText, FileWarning, Image, Terminal, X } from "@/components/ui/icons";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeBlockCode } from "./code-block";
import { Markdown } from "./markdown";

interface FileViewerProps {
  filePath: string | null;
  onClose?: () => void;
  onOpenTerminal?: () => void;
  className?: string;
}

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

export function FileViewer({
  filePath,
  onClose,
  onOpenTerminal,
  className,
}: FileViewerProps) {
  const [fileContent, setFileContent] = React.useState<FileContent | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (filePath) {
      setIsLoading(true);
      setError(null);
      window.pidesk.fs
        .readFile(filePath)
        .then((result) => {
          setFileContent(result);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load file");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setFileContent(null);
      setError(null);
    }
  }, [filePath]);

  if (!filePath) {
    return null;
  }

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  const language = getLanguageFromPath(filePath);
  const isMarkdown = isMarkdownFile(filePath);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface-2 px-4",
          "transition-colors duration-150 ease-out",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {fileContent?.type === "image" ? (
            <Image className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium text-foreground">
            {fileName}
          </span>
          {fileContent?.type === "text" && (
            <span className="shrink-0 text-xs text-muted-foreground">
              ({language})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onOpenTerminal && (
            <button
              type="button"
              onClick={onOpenTerminal}
              className={cn(
                "rounded p-1 text-muted-foreground",
                "transition-all duration-150 ease-out",
                "hover:bg-surface-3 hover:text-foreground",
                "active:scale-95",
              )}
              aria-label="Open terminal"
            >
              <Terminal className="size-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "rounded p-1 text-muted-foreground",
                "transition-all duration-150 ease-out",
                "hover:bg-surface-3 hover:text-foreground",
                "active:scale-95",
              )}
              aria-label="Close file"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading && (
          <div
            className={cn(
              "flex h-full items-center justify-center text-sm text-muted-foreground",
              "animate-pulse",
            )}
          >
            Loading...
          </div>
        )}

        {error && (
          <div
            className={cn(
              "flex h-full items-center justify-center text-sm text-destructive",
              "animate-in fade-in duration-200",
            )}
          >
            {error}
          </div>
        )}

        {fileContent?.type === "binary" && (
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
              "transition-opacity duration-200 ease-out",
            )}
          >
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2",
                "transition-all duration-150 ease-out",
                "hover:scale-105",
              )}
            >
              <Binary className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Binary file</p>
              <p className="text-xs text-muted-foreground">
                This file cannot be displayed in the text viewer
              </p>
            </div>
          </div>
        )}
        {fileContent?.type === "image" && fileContent.content && (
          <div
            className={cn(
              "flex h-full items-center justify-center p-4",
              "transition-opacity duration-200 ease-out",
            )}
          >
            <img
              src={fileContent.content}
              alt={fileName}
              className={cn(
                "max-h-full max-w-full object-contain",
                "transition-all duration-200 ease-out",
                "hover:scale-[1.02]",
              )}
            />
          </div>
        )}

        {fileContent?.type === "unsupported" && (
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
              "transition-opacity duration-200 ease-out",
            )}
          >
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2",
                "transition-all duration-150 ease-out",
                "hover:scale-105",
              )}
            >
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
        )}

        {fileContent?.type === "text" && fileContent.content && (
          <div className="h-full">
            {fileContent.truncated && (
              <div
                className={cn(
                  "flex items-start gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm",
                  "transition-colors duration-150 ease-out",
                  "hover:bg-warning/15",
                )}
              >
                <FileWarning className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-warning-foreground">
                    Large file
                  </p>
                  <p className="text-muted-foreground">
                    This file exceeds 1MB and has been truncated. Showing first
                    portion only.
                  </p>
                </div>
              </div>
            )}
            {isMarkdown ? (
              <div className="p-4">
                <Markdown>{fileContent.content}</Markdown>
              </div>
            ) : (
              <CodeBlockCode
                code={fileContent.content}
                language={language}
                className="h-full"
              />
            )}
          </div>
        )}

        {fileContent?.type === "text" && !fileContent.content && (
          <div
            className={cn(
              "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
              "transition-opacity duration-200 ease-out",
            )}
          >
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-xl bg-surface-2",
                "transition-all duration-150 ease-out",
                "hover:scale-105",
              )}
            >
              <FileIcon className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Empty file</p>
              <p className="text-xs text-muted-foreground">
                This file has no content
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
