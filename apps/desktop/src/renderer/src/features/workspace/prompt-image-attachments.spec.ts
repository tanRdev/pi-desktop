import { describe, expect, it, vi } from "vitest";
import {
  getPromptImageMimeType,
  loadPromptImageAttachments,
  parseImageDataUrl,
} from "./prompt-image-attachments";
import { buildFileMention } from "./prompt-routing";

describe("getPromptImageMimeType", () => {
  it("maps supported image extensions and rejects others", () => {
    expect(getPromptImageMimeType("/tmp/shot.PNG")).toBe("image/png");
    expect(getPromptImageMimeType("/tmp/photo.jpg")).toBe("image/jpeg");
    expect(getPromptImageMimeType("/tmp/photo.jpeg")).toBe("image/jpeg");
    expect(getPromptImageMimeType("/tmp/anim.gif")).toBe("image/gif");
    expect(getPromptImageMimeType("/tmp/pic.webp")).toBe("image/webp");
    expect(getPromptImageMimeType("/tmp/notes.md")).toBeNull();
    expect(getPromptImageMimeType("/tmp/archive.zip")).toBeNull();
  });
});

describe("parseImageDataUrl", () => {
  it("parses data URLs with allowlisted MIME types", () => {
    expect(parseImageDataUrl("data:image/png;base64,aGVsbG8=")).toEqual({
      mimeType: "image/png",
      data: "aGVsbG8=",
    });
  });

  it("rejects non-image or malformed content", () => {
    expect(parseImageDataUrl("data:image/bmp;base64,AA==")).toBeNull();
    expect(parseImageDataUrl("plain text")).toBeNull();
    expect(parseImageDataUrl("data:image/png;base64,")).toBeNull();
  });
});

describe("loadPromptImageAttachments", () => {
  it("builds typed attachments from image file mentions", async () => {
    const readFile = vi.fn(async (path: string) => ({
      path,
      type: "image" as const,
      content: "data:image/png;base64,aGVsbG8=",
      mimeType: "image/png",
    }));

    const draft = `look at this ${buildFileMention("/tmp/shot.png")}`;
    const attachments = await loadPromptImageAttachments(draft, readFile);

    expect(readFile).toHaveBeenCalledWith("/tmp/shot.png");
    expect(attachments).toEqual([
      {
        type: "image",
        mimeType: "image/png",
        data: "aGVsbG8=",
        name: "shot.png",
      },
    ]);
  });

  it("skips non-image mentions and unreadable files", async () => {
    const readFile = vi.fn(async (path: string) => {
      if (path.endsWith(".png")) {
        throw new Error("gone");
      }
      return { path, type: "text" as const, content: "hello" };
    });

    const draft = [
      buildFileMention("/tmp/notes.md"),
      buildFileMention("/tmp/gone.png"),
    ].join(" ");
    await expect(loadPromptImageAttachments(draft, readFile)).resolves.toEqual(
      [],
    );
    // The text file is never read as an image.
    expect(readFile).not.toHaveBeenCalledWith("/tmp/notes.md");
  });

  it("returns no attachments when the draft has no mentions", async () => {
    const readFile = vi.fn(async () => ({}));
    await expect(
      loadPromptImageAttachments("just text", readFile),
    ).resolves.toEqual([]);
    expect(readFile).not.toHaveBeenCalled();
  });
});
