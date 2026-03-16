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
  type: "text" | "binary" | "unsupported";
  encoding?: string;
}