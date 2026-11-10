import type {
  PromptImageAttachment,
  PromptImageMimeType,
} from "@pi-desktop/shared";
import { getFileMentionPaths } from "./prompt-routing";

/**
 * Build typed image attachments for a draft (issue #10).
 *
 * The composer references attached files as `@file:` mentions. For image
 * files, the bytes are loaded through the existing `fs.readFile` IPC —
 * which returns image content as a `data:<mime>;base64,…` URL — and
 * converted into `PromptImageAttachment`s so the prompt/steer contracts
 * carry the bytes and MIME type to the runtime instead of a local path.
 *
 * Non-image mentions stay as expanded paths in the prompt text. Files
 * that fail to load are skipped (their path remains in the text, so no
 * context is lost).
 */

const IMAGE_MIME_BY_EXTENSION: Record<string, PromptImageMimeType> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Keep a single prompt's image payload bounded. */
export const MAX_PROMPT_IMAGE_ATTACHMENTS = 4;

export function getPromptImageMimeType(
  filePath: string,
): PromptImageMimeType | null {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME_BY_EXTENSION[extension] ?? null;
}

export function parseImageDataUrl(
  content: string,
): { mimeType: PromptImageMimeType; data: string } | null {
  const match = /^data:(image\/(?:gif|jpeg|png|webp));base64,(.+)$/s.exec(
    content,
  );
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1] as PromptImageMimeType,
    data: match[2] as string,
  };
}

type ReadFile = (path: string) => Promise<unknown>;

export async function loadPromptImageAttachments(
  draft: string,
  readFile: ReadFile = (path) => window.piDesktop.fs.readFile(path),
): Promise<PromptImageAttachment[]> {
  const imagePaths = getFileMentionPaths(draft)
    .filter((filePath) => getPromptImageMimeType(filePath) !== null)
    .slice(0, MAX_PROMPT_IMAGE_ATTACHMENTS);

  const attachments: PromptImageAttachment[] = [];
  for (const filePath of imagePaths) {
    try {
      const result = await readFile(filePath);
      if (
        typeof result !== "object" ||
        result === null ||
        !("content" in result) ||
        typeof result.content !== "string"
      ) {
        continue;
      }
      const parsed = parseImageDataUrl(result.content);
      if (!parsed) {
        continue;
      }
      attachments.push({
        type: "image",
        mimeType: parsed.mimeType,
        data: parsed.data,
        name: filePath.split(/[/\\]/).pop() ?? filePath,
      });
    } catch {
      // Skip unreadable images; the expanded path stays in the prompt.
    }
  }
  return attachments;
}
