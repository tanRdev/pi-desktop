import type { FileContent } from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import { File, Image as ImageIcon, Save } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { MonacoFileEditor } from "./monaco-file-editor";

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

function getFileLanguage(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";

  switch (extension) {
    case "cjs":
    case "cts":
    case "js":
    case "jsx":
    case "mjs":
    case "mts":
    case "ts":
    case "tsx":
      return "typescript";
    case "css":
      return "css";
    case "go":
      return "go";
    case "html":
      return "html";
    case "java":
      return "java";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "py":
      return "python";
    case "rb":
      return "ruby";
    case "rs":
      return "rust";
    case "sh":
      return "shell";
    case "sql":
      return "sql";
    case "xml":
      return "xml";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "plaintext";
  }
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

function FileContentSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.04] bg-transparent px-5">
        <div className="h-4 w-32 bg-white/5" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 p-5">
        <div className="h-3 w-full bg-white/5" />
        <div className="h-3 w-5/6 bg-white/5" />
        <div className="h-3 w-4/5 bg-white/5" />
        <div className="h-3 w-full bg-white/5" />
        <div className="h-3 w-3/4 bg-white/5" />
        <div className="h-3 w-full bg-white/5" />
        <div className="h-3 w-2/3 bg-white/5" />
        <div className="h-3 w-full bg-white/5" />
      </div>
    </div>
  );
}

function TextContent({
  filePath,
  content,
  isReadOnly,
  onContentChange,
  onSave,
  className,
}: {
  filePath: string;
  content: FileContent;
  isReadOnly: boolean;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <MonacoFileEditor
        path={filePath}
        language={getFileLanguage(filePath)}
        value={content.content}
        readOnly={isReadOnly}
        onChange={onContentChange}
        onSave={onSave}
      />
    </div>
  );
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

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isReadOnly && onSave) {
          onSave();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isReadOnly, onSave]);

  const toolbar = onSave ? (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.04] bg-transparent px-5">
      <div className="text-[10.5px] font-normal uppercase tracking-wider text-white/30">
        {fileName}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onSave}
        disabled={isReadOnly || !isDirty}
        className="h-6 gap-1.5 px-2 text-[10.5px] uppercase tracking-wider text-white/40"
      >
        <Save className="size-3" />
        Save
      </Button>
    </div>
  ) : null;

  function renderContent() {
    if (error) {
      return (
        <div
          className={cn("flex h-full items-center justify-center", className)}
        >
          <div className="flex flex-col items-center gap-3 text-center text-red-400/80">
            <File className="h-7 w-7" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      );
    }

    if (!content) {
      return (
        <div
          className={cn("flex h-full items-center justify-center", className)}
        >
          <div className="flex flex-col items-center gap-3 text-white/50">
            <File className="h-7 w-7" />
            <span className="text-sm">No file loaded</span>
          </div>
        </div>
      );
    }

    if (content.type === "binary") {
      return (
        <div
          className={cn("flex h-full items-center justify-center", className)}
        >
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
        <div
          className={cn("flex h-full items-center justify-center", className)}
        >
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

    if (content.type === "text") {
      return (
        <div className={cn("flex h-full flex-col", className)}>
          {toolbar}
          <TextContent
            filePath={filePath}
            content={content}
            isReadOnly={isReadOnly}
            onContentChange={onContentChange}
            onSave={onSave}
            className="min-h-0 flex-1"
          />
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

  return (
    <Skeleton
      name="file-content"
      loading={isLoading ?? false}
      fixture={<FileContentSkeleton />}
      className={cn("h-full", className)}
    >
      {renderContent()}
    </Skeleton>
  );
}
