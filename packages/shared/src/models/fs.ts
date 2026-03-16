export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

export interface FileContent {
  path: string;
  content: string;
  type: "text" | "binary" | "image" | "unsupported";
  encoding?: string;
  size?: number;
  truncated?: boolean;
  mimeType?: string; // For image files
}

/**
 * Image dimensions from sharp.
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Image metadata from sharp.
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  density?: number;
  hasAlpha?: boolean;
  space?: string;
  channels?: number;
  depth?: string;
}

/**
 * Image preview options.
 */
export interface ImagePreviewOptions {
  /** Maximum width for preview */
  maxWidth?: number;
  /** Maximum height for preview */
  maxHeight?: number;
  /** Output format */
  format?: "jpeg" | "png" | "webp";
  /** Quality (1-100) */
  quality?: number;
}

/**
 * Image preview result.
 */
export interface ImagePreview {
  /** Base64 encoded preview data */
  data: string;
  /** Data URL MIME prefix */
  mimeType: string;
  /** Preview dimensions */
  width: number;
  height: number;
  /** Original dimensions */
  originalWidth: number;
  originalHeight: number;
}
