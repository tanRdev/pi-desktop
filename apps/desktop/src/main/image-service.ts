/**
 * Image processing service using sharp.
 * Provides metadata extraction and preview generation for image files.
 */

import { stat } from "node:fs/promises";
import type {
  ImageMetadata,
  ImagePreview,
  ImagePreviewOptions,
} from "@pidesk/shared";

type SharpInstance = import("sharp").Sharp;
type SharpMetadata = import("sharp").Metadata;

// Lazy load sharp to handle optional dependency
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
        return sharpFactory(input);
      }
      return sharpFactory();
    };
    return sharpModule;
  } catch {
    throw new Error(
      "sharp is not installed. Image processing is unavailable. Run: pnpm add sharp",
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
    try {
      await getSharp();
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(filePath: string): Promise<ImageMetadata> {
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
      "sharp is not installed. Image processing is unavailable. Run: pnpm add sharp",
    );
  }

  async getPreview(
    _filePath: string,
    _options?: ImagePreviewOptions,
  ): Promise<ImagePreview> {
    throw new Error(
      "sharp is not installed. Image processing is unavailable. Run: pnpm add sharp",
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
