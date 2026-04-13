import type { FileContent } from "@pidesk/shared";
import * as React from "react";
import { File, Image as ImageIcon, Loader2, Save } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { CodeEditor } from "../ui/code-editor";
import { Markdown } from "../ui/markdown";
import { ScrollArea } from "../ui/scroll-area";

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
};

function getLanguageFromPath(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) {
    return "plaintext";
  }

  const extension = filePath.slice(lastDot).toLowerCase();
  return EXTENSION_TO_LANGUAGE[extension] ?? "plaintext";
}

function isMarkdownFile(filePath: string): boolean {
  return /\.(md|markdown)$/i.test(filePath);
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

export interface WorkspaceFileContentProps {
  filePath: string;
  content: FileContent | null;
  isLoading?: boolean;
  error?: string | null;
  isDirty?: boolean;
  isReadOnly?: boolean;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  className?: string;
}

export function WorkspaceFileContent({
  filePath,
  content,
  isLoading,
  error,
  isDirty,
  isReadOnly = false,
  onContentChange,
  onSave,
  className,
}: WorkspaceFileContentProps) {
  const fileName = getFileName(filePath);
  const [draft, setDraft] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (content?.type === "text") {
      setDraft(content.content);
    }
  }, [content]);

  const handleContentChange = React.useCallback(
    (nextValue: string) => {
      setDraft(nextValue);
      onContentChange?.(nextValue);
    },
    [onContentChange],
  );

  const toolbar = onSave ? (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.04] bg-transparent px-5">
      <div className="text-[14px] font-semibold uppercase tracking-wider text-white/30">
        {fileName}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onSave}
        disabled={isReadOnly || !isDirty}
        className="h-6 gap-1.5 px-2 text-[14px] uppercase tracking-wider text-white/40"
      >
        <Save className="size-3" />
        Save
      </Button>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-white/50">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="text-sm">Loading {fileName}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-center text-red-400/80">
          <File className="h-7 w-7" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-white/50">
          <File className="h-7 w-7" />
          <span className="text-sm">No file loaded</span>
        </div>
      </div>
    );
  }

  if (content.type === "binary") {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-white/50">
          <File className="h-7 w-7" />
          <span className="text-sm">Binary file</span>
          <span className="text-xs text-white/30">
            {content.size ?? 0} bytes
          </span>
        </div>
      </div>
    );
  }

  if (content.type === "unsupported") {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-3 text-white/50">
          <File className="h-7 w-7" />
          <span className="text-sm">Unsupported preview</span>
        </div>
      </div>
    );
  }

  if (content.type === "image") {
    const imageSource = content.content.startsWith("data:")
      ? content.content
      : `data:${content.mimeType ?? "image/png"};base64,${content.content}`;

    return (
      <div
        className={cn(
          "flex h-full flex-col bg-[var(--color-bg-primary)]",
          className,
        )}
      >
        {toolbar}
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <img
            src={imageSource}
            alt={fileName}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (content.type === "text" && isMarkdownFile(filePath)) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        {toolbar}
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-5 py-4">
            <Markdown>{draft ?? content.content}</Markdown>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (content.type === "text") {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        {toolbar}
        <div className="min-h-0 flex-1">
          <CodeEditor
            filePath={filePath}
            value={draft ?? content.content}
            language={getLanguageFromPath(filePath)}
            readOnly={isReadOnly}
            onChange={handleContentChange}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full items-center justify-center", className)}>
      <div className="flex flex-col items-center gap-3 text-white/50">
        <ImageIcon className="h-7 w-7" />
        <span className="text-sm">No preview available</span>
      </div>
    </div>
  );
}
