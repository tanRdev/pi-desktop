import type {
  InstalledPackageSnapshot,
  PackageCatalogDetail,
  PackageInstallRequest,
  PackageManagerStatus,
  PackageOperationSnapshot,
  PackageRemoveRequest,
  PackageSearchRequest,
  PackageSearchResponse,
  PackagesEvent,
  PackageUpdateRequest,
} from "@pidesk/shared";

export interface PackagesService {
  getManagerStatus(): Promise<PackageManagerStatus>;
  searchCatalog(request: PackageSearchRequest): Promise<PackageSearchResponse>;
  getPackageDetail(packageName: string): Promise<PackageCatalogDetail>;
  listInstalled(
    scope?: "global" | "local",
  ): Promise<InstalledPackageSnapshot[]>;
  install(request: PackageInstallRequest): Promise<PackageOperationSnapshot>;
  remove(request: PackageRemoveRequest): Promise<PackageOperationSnapshot>;
  update(request: PackageUpdateRequest): Promise<PackageOperationSnapshot>;
  subscribe(listener: (event: PackagesEvent) => void): () => void;
}
