import type { FileContent } from "@pidesk/shared";
import { FileText, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeBlock, CodeBlockCode } from "./code-block";
import { Markdown } from "./markdown";

interface FileViewerProps {
  filePath: string | null;
  onClose?: () => void;
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

export function FileViewer({ filePath, onClose, className }: FileViewerProps) {
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
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {fileName}
          </span>
          {fileContent?.type === "text" && (
            <span className="shrink-0 text-xs text-muted-foreground">
              ({language})
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
            aria-label="Close file"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}

        {error && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}

        {fileContent?.type === "binary" && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Binary file - cannot display
          </div>
        )}

        {fileContent?.type === "unsupported" && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Unsupported file type
          </div>
        )}

        {fileContent?.type === "text" && fileContent.content && (
          <div className="p-4">
            {isMarkdown ? (
              <Markdown>{fileContent.content}</Markdown>
            ) : (
              <CodeBlock className="border-0 bg-transparent">
                <CodeBlockCode code={fileContent.content} language={language} />
              </CodeBlock>
            )}
          </div>
        )}

        {fileContent?.type === "text" && !fileContent.content && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Empty file
          </div>
        )}
      </div>
    </div>
  );
}