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
