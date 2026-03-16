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