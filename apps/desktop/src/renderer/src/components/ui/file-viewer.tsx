import type { FileContent } from "@pidesk/shared";
import * as React from "react";
import {
  Binary,
  FileIcon,
  FileText,
  FileWarning,
  Image,
  Terminal,
  X,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CodeBlockCode } from "./code-block";
import { Markdown } from "./markdown";

interface FileViewerProps {
  filePath: string | null;
  onClose?: () => void;
  onOpenTerminal?: () => void;
  className?: string;
}

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
          "flex h-12 shrink-0 items-center justify-between border-b border-white/[0.04] bg-[var(--color-bg-secondary)] px-4",
          "transition-colors duration-150 ease-out",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {fileContent?.type === "image" ? (
            <Image className="size-5 shrink-0 text-white/30" />
          ) : (
            <FileText className="size-5 shrink-0 text-white/30" />
          )}
          <span className="truncate text-sm font-medium text-white/80">
            {fileName}
          </span>
          {fileContent?.type === "text" && (
            <span className="shrink-0 text-xs text-white/40">({language})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onOpenTerminal && (
            <button
              type="button"
              onClick={onOpenTerminal}
              className={cn(
                "rounded-md p-1 text-white/30",
                "transition-all duration-150 ease-out",
                "hover:bg-white/[0.06] hover:text-white/80",
                "active:scale-95",
              )}
              aria-label="Open terminal"
            >
              <Terminal className="size-5" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "rounded-md p-1 text-white/30",
                "transition-all duration-150 ease-out",
                "hover:bg-white/[0.06] hover:text-white/80",
                "active:scale-95",
              )}
              aria-label="Close file"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--color-bg-primary)]">
        {isLoading && (
          <div
            className={cn(
              "flex h-full items-center justify-center text-sm text-white/50",
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
                "flex h-16 w-16 items-center justify-center rounded-md bg-white/[0.02] border border-white/[0.04]",
                "transition-all duration-150 ease-out",
                "hover:scale-105",
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
                "flex h-16 w-16 items-center justify-center rounded-md bg-white/[0.02] border border-white/[0.04]",
                "transition-all duration-150 ease-out",
                "hover:scale-105",
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
                <FileWarning className="mt-0.5 size-5 shrink-0 text-warning" />
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
                "flex h-16 w-16 items-center justify-center rounded-md bg-white/[0.02] border border-white/[0.04]",
                "transition-all duration-150 ease-out",
                "hover:scale-105",
              )}
            >
              <FileIcon className="size-8 text-white/30" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/80">Empty file</p>
              <p className="text-xs text-white/40">This file has no content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
