import * as React from "react";
import { buildFileMention } from "../../../lib/prompt-routing";
import { FileUpload, type UploadedFile } from "../../ui/file-upload";
import { Image } from "../../ui/image";

function isImagePath(filePath: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath);
}

export interface AttachmentsState {
  uploadedFiles: UploadedFile[];
  imageFiles: UploadedFile[];
  handlePickFiles: () => Promise<void>;
  handleRemoveFile: (fileId: string) => void;
}

export function useAttachments(
  draft: string,
  onDraftChange: (draft: string) => void,
): AttachmentsState {
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);

  const imageFiles = React.useMemo(
    () => uploadedFiles.filter((file) => file.kind === "image"),
    [uploadedFiles],
  );

  const handlePickFiles = React.useCallback(async () => {
    const selectedPaths = await window.piDesktop.dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      title: "Attach files to prompt",
    });

    if (!selectedPaths || selectedPaths.length === 0) {
      return;
    }

    setUploadedFiles((currentFiles) => {
      const nextFiles = [...currentFiles];
      for (const filePath of selectedPaths) {
        if (nextFiles.some((file) => file.path === filePath)) {
          continue;
        }
        nextFiles.push({
          id: `${Date.now()}-${filePath}`,
          name: filePath.split(/[/\\]/).pop() ?? filePath,
          path: filePath,
          kind: isImagePath(filePath) ? "image" : "file",
        });
      }
      return nextFiles;
    });

    const nextMentions = selectedPaths
      .map((filePath) => buildFileMention(filePath))
      .filter((mention) => !draft.includes(mention))
      .join("");

    if (nextMentions.length > 0) {
      onDraftChange(
        `${draft}${draft.endsWith(" ") || draft.length === 0 ? "" : " "}${nextMentions}`,
      );
    }
  }, [draft, onDraftChange]);

  const handleRemoveFile = React.useCallback(
    (fileId: string) => {
      setUploadedFiles((currentFiles) => {
        const removedFile = currentFiles.find((file) => file.id === fileId);
        if (removedFile) {
          const nextDraft = draft
            .split(buildFileMention(removedFile.path))
            .join("")
            .replace(/\s{2,}/g, " ")
            .trimStart();
          if (nextDraft !== draft) {
            onDraftChange(nextDraft);
          }
        }
        return currentFiles.filter((file) => file.id !== fileId);
      });
    },
    [draft, onDraftChange],
  );

  return { uploadedFiles, imageFiles, handlePickFiles, handleRemoveFile };
}

export interface AttachmentsProps {
  uploadedFiles: UploadedFile[];
  imageFiles: UploadedFile[];
  disabled: boolean;
  onPickFiles: () => void | Promise<void>;
  onRemoveFile: (fileId: string) => void;
}

export function Attachments({
  uploadedFiles,
  imageFiles,
  disabled,
  onPickFiles,
  onRemoveFile,
}: AttachmentsProps) {
  return (
    <>
      <FileUpload
        files={uploadedFiles}
        disabled={disabled}
        onPickFiles={onPickFiles}
        onRemoveFile={onRemoveFile}
        className="mb-[var(--space-3)]"
      />

      {imageFiles.length > 0 ? (
        <div className="mb-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)]">
          {imageFiles.slice(0, 2).map((file) => (
            <Image
              key={file.id}
              src={`file://${file.path}`}
              alt={file.name}
              aspect="landscape"
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
