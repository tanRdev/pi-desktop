import { ImageIcon, Paperclip, X } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  id: string;
  name: string;
  path: string;
  kind: "file" | "image";
}

export interface FileUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  files: UploadedFile[];
  disabled?: boolean;
  onPickFiles: () => void | Promise<void>;
  onRemoveFile: (fileId: string) => void;
}

export function FileUpload({
  files,
  disabled,
  onPickFiles,
  onRemoveFile,
  className,
  ...props
}: FileUploadProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => void onPickFiles()}
        className="h-7 border border-[#474747]/20 bg-[#141414] px-2 text-[9px] text-[#a0a0a0] hover:border-white/35 hover:bg-[#1a1a1a] hover:text-white"
      >
        <Paperclip className="size-3.5" />
        Attach files
      </Button>

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 border border-[#474747]/20 bg-[#101010] px-2 py-1"
            >
              {file.kind === "image" ? (
                <ImageIcon className="size-3.5 text-[#bfbfbf]" />
              ) : (
                <Paperclip className="size-3.5 text-[#bfbfbf]" />
              )}
              <span className="max-w-[12rem] truncate font-mono text-[10px] uppercase tracking-[0.16em] text-white/78">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
                className="text-[#6f6f6f] transition-colors hover:text-white"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
