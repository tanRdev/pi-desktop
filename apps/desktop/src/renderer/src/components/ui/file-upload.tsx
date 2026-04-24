import type * as React from "react";
import { ICON_SIZE_SM, Image, Paperclip, X } from "@/components/ui/icons";
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
              className="flex items-center gap-2 border border-white/[0.06] bg-white/[0.06] px-2 py-1"
            >
              {file.kind === "image" ? (
                <Image className={`${ICON_SIZE_SM} text-white/70`} />
              ) : (
                <Paperclip className={`${ICON_SIZE_SM} text-white/70`} />
              )}
              <span className="max-w-[12rem] truncate font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
                className="text-white/50 transition-colors hover:text-white/60"
                aria-label={`Remove ${file.name}`}
              >
                <X className={ICON_SIZE_SM} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
