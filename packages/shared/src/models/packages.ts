export type PackageKind = "extension" | "skill" | "theme" | "prompt";

export type PackageSort = "downloads" | "recent" | "name";

export type PackageInstallScope = "global" | "local";

export type PackageManagerCapability = "available" | "unavailable";

export interface PackageCatalogItem {
  name: string;
  version: string;
  description: string;
  downloads: number;
  publishedAt: string | null;
  kinds: PackageKind[];
  author: string | null;
  maintainers: string[];
  repositoryUrl: string | null;
  npmUrl: string;
  readmeUrl: string | null;
  hasDemo: boolean;
  demoVideoUrl: string | null;
  demoImageUrl: string | null;
}

export interface PackageCatalogDetail extends PackageCatalogItem {
  keywords: string[];
  readmeMarkdown: string | null;
  installCommand: string;
}

export interface PackageSearchRequest {
  query: string;
  sort: PackageSort;
  kinds: PackageKind[];
  hasDemoOnly?: boolean;
}

export interface PackageSearchResponse {
  query: string;
  sort: PackageSort;
  total: number;
  packages: PackageCatalogItem[];
}

export interface InstalledPackageSnapshot {
  source: string;
  name: string;
  version: string | null;
  scope: PackageInstallScope;
  installPath: string | null;
  isPinned: boolean;
}

export type PackageOperationKind = "install" | "remove" | "update" | "refresh";

export type PackageOperationStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export interface PackageOperationSnapshot {
  id: string;
  packageName: string;
  scope: PackageInstallScope;
  kind: PackageOperationKind;
  status: PackageOperationStatus;
  message: string | null;
  output: string[];
}

export type PackagesEvent =
  | {
      type: "operation_updated";
      operation: PackageOperationSnapshot;
    }
  | {
      type: "installed_state_changed";
      scope: PackageInstallScope;
      installed: InstalledPackageSnapshot[];
    };

export interface PackageManagerStatus {
  cli: PackageManagerCapability;
  network: PackageManagerCapability;
  authenticated: boolean;
  message: string | null;
}

export interface PackageInstallRequest {
  packageName: string;
  scope: PackageInstallScope;
}

export interface PackageRemoveRequest {
  packageName: string;
  scope: PackageInstallScope;
}

export interface PackageUpdateRequest {
  packageName?: string;
  scope: PackageInstallScope;
}
