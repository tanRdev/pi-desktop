import { Image, Paperclip, X } from "@phosphor-icons/react";
import type * as React from "react";
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
  disabled: _disabled,
  onPickFiles: _onPickFiles,
  onRemoveFile,
  className,
  ...props
}: FileUploadProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 border border-[#474747]/20 bg-[#101010] px-2 py-1"
            >
              {file.kind === "image" ? (
                <Image className="size-3.5 text-[#bfbfbf]" />
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
