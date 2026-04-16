/**
 * Image processing service using sharp.
 * Provides metadata extraction and preview generation for image files.
 */

import { stat } from "node:fs/promises";
import path from "node:path";
import type {
  ImageMetadata,
  ImagePreview,
  ImagePreviewOptions,
} from "@pi-desktop/shared";

type SharpInstance = import("sharp").Sharp;
type SharpMetadata = import("sharp").Metadata;

/**
 * Guard rails to keep the main process from being weaponised by a crafted
 * image path or a decompression bomb.
 *   - PIXEL_LIMIT: sharp bails on inputs above this (default 268M = 16384²).
 *   - MAX_FILE_BYTES: 64 MiB covers realistic camera RAWs without letting a
 *     single IPC call pin the process on memory.
 *   - ALLOWED_EXTENSIONS: extension allowlist, case-insensitive.
 */
const PIXEL_LIMIT = 268_435_456;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
]);

async function assertSafeImagePath(filePath: string): Promise<void> {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new Error("Image path must be a non-empty string");
  }
  if (!path.isAbsolute(filePath)) {
    throw new Error("Image path must be absolute");
  }
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported image extension: ${ext || "<none>"}`);
  }
  const stats = await stat(filePath);
  if (!stats.isFile()) {
    throw new Error("Image path does not refer to a regular file");
  }
  if (stats.size > MAX_FILE_BYTES) {
    throw new Error(
      `Image exceeds maximum file size of ${MAX_FILE_BYTES} bytes`,
    );
  }
}

let sharpModule: ((input?: string | Buffer) => SharpInstance) | null = null;

function isSharpFactory(
  value: unknown,
): value is (input?: string | Buffer) => SharpInstance {
  return typeof value === "function";
}

async function getSharp(): Promise<(input?: string | Buffer) => SharpInstance> {
  if (sharpModule) return sharpModule;

  try {
    const sharpImport = await import("sharp");
    const sharpFactoryCandidate =
      "default" in sharpImport ? sharpImport.default : sharpImport;
    if (!isSharpFactory(sharpFactoryCandidate)) {
      throw new Error("sharp did not expose a callable factory");
    }
    const sharpFactory = sharpFactoryCandidate;
    sharpModule = (input) => {
      if (typeof input === "string" || Buffer.isBuffer(input)) {
        return sharpFactory(input, { limitInputPixels: PIXEL_LIMIT });
      }
      return sharpFactory(undefined, { limitInputPixels: PIXEL_LIMIT });
    };
    return sharpModule;
  } catch {
    throw new Error(
      "sharp is not installed. Image processing is unavailable. Run: bun add sharp",
    );
  }
}

/**
 * Image service interface.
 */
export interface ImageServiceInterface {
  /**
   * Get image metadata.
   */
  getMetadata(filePath: string): Promise<ImageMetadata>;

  /**
   * Generate a preview/thumbnail of the image.
   */
  getPreview(
    filePath: string,
    options?: ImagePreviewOptions,
  ): Promise<ImagePreview>;

  /**
   * Check if sharp is available.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Image processing service implementation.
 */
export class ImageService implements ImageServiceInterface {
  async isAvailable(): Promise<boolean> {
    return getSharp().then(
      () => true,
      () => false,
    );
  }

  async getMetadata(filePath: string): Promise<ImageMetadata> {
    await assertSafeImagePath(filePath);
    const sharp = await getSharp();

    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();
      const stats = await stat(filePath);

      return {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        format: metadata.format ?? "unknown",
        size: stats.size,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
      };
    } catch (error) {
      throw new Error(
        `Failed to get image metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getPreview(
    filePath: string,
    options?: ImagePreviewOptions,
  ): Promise<ImagePreview> {
    await assertSafeImagePath(filePath);
    const sharp = await getSharp();

    const maxWidth = options?.maxWidth ?? 800;
    const maxHeight = options?.maxHeight ?? 600;
    const format = options?.format ?? "jpeg";
    const quality = options?.quality ?? 85;

    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      const originalWidth = metadata.width ?? 0;
      const originalHeight = metadata.height ?? 0;

      let pipeline: SharpInstance = image.clone();

      if (originalWidth > maxWidth || originalHeight > maxHeight) {
        pipeline = pipeline.resize(maxWidth, maxHeight, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      let outputBuffer: Buffer;
      let mimeType: string;

      switch (format) {
        case "png":
          outputBuffer = await pipeline.png().toBuffer();
          mimeType = "image/png";
          break;
        case "webp":
          outputBuffer = await pipeline.webp({ quality }).toBuffer();
          mimeType = "image/webp";
          break;
        default:
          outputBuffer = await pipeline.jpeg({ quality }).toBuffer();
          mimeType = "image/jpeg";
          break;
      }

      const outputInfo: SharpMetadata = await sharp(outputBuffer).metadata();

      return {
        data: `data:${mimeType};base64,${outputBuffer.toString("base64")}`,
        mimeType,
        width: outputInfo.width ?? maxWidth,
        height: outputInfo.height ?? maxHeight,
        originalWidth,
        originalHeight,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate image preview: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

/**
 * Fallback image service that doesn't use sharp.
 * Used when sharp is not available.
 */
export class FallbackImageService implements ImageServiceInterface {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async getMetadata(_filePath: string): Promise<ImageMetadata> {
    throw new Error(
      "sharp is not installed. Image processing is unavailable. Run: bun add sharp",
    );
  }

  async getPreview(
    _filePath: string,
    _options?: ImagePreviewOptions,
  ): Promise<ImagePreview> {
    throw new Error(
      "sharp is not installed. Image processing is unavailable. Run: bun add sharp",
    );
  }
}

/**
 * Create an image service instance.
 * Returns a fallback service if sharp is not available.
 */
export async function createImageService(): Promise<ImageServiceInterface> {
  const service = new ImageService();

  if (await service.isAvailable()) {
    return service;
  }

  return new FallbackImageService();
}
