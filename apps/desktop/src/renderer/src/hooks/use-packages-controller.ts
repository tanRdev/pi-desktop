import type {
  InstalledPackageSnapshot,
  PackageCatalogDetail,
  PackageCatalogItem,
  PackageInstallScope,
  PackageKind,
  PackageManagerStatus,
  PackageOperationSnapshot,
  PackageSort,
} from "@pidesk/shared";
import * as React from "react";

export const PACKAGE_KIND_OPTIONS: PackageKind[] = [
  "extension",
  "skill",
  "theme",
  "prompt",
];

export const PACKAGE_TABS = ["browse", "installed"] as const;

export type PackagesTab = (typeof PACKAGE_TABS)[number];

export interface UsePackagesControllerOptions {
  open: boolean;
}

export function usePackagesController({ open }: UsePackagesControllerOptions) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<PackageSort>("downloads");
  const [selectedScope, setSelectedScope] =
    React.useState<PackageInstallScope>("local");
  const [selectedTab, setSelectedTab] = React.useState<PackagesTab>("browse");
  const [selectedKinds, setSelectedKinds] = React.useState<PackageKind[]>([]);
  const [hasDemoOnly, setHasDemoOnly] = React.useState(false);
  const [status, setStatus] = React.useState<PackageManagerStatus | null>(null);
  const [packages, setPackages] = React.useState<PackageCatalogItem[]>([]);
  const [selectedPackageName, setSelectedPackageName] = React.useState<
    string | null
  >(null);
  const [selectedPackageDetail, setSelectedPackageDetail] =
    React.useState<PackageCatalogDetail | null>(null);
  const [installedPackages, setInstalledPackages] = React.useState<
    InstalledPackageSnapshot[]
  >([]);
  const [activeOperation, setActiveOperation] =
    React.useState<PackageOperationSnapshot | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = React.useState(false);
  const [isLoadingInstalled, setIsLoadingInstalled] = React.useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasActiveWorktree, setHasActiveWorktree] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const unsubscribe = window.pidesk.packages.subscribe((event) => {
      if (cancelled) {
        return;
      }

      if (event.type === "operation_updated") {
        setActiveOperation(event.operation);
      }

      if (event.type === "installed_state_changed") {
        setInstalledPackages(event.installed);
      }
    });

    void window.pidesk.packages
      .getManagerStatus()
      .then((nextStatus) => {
        if (!cancelled) {
          setStatus(nextStatus);
        }
      })
      .then(() => window.pidesk.shell.getSnapshot())
      .then((snapshot) => {
        if (!cancelled) {
          setHasActiveWorktree(snapshot.catalog.selection.worktreeId !== null);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load package status",
          );
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoadingCatalog(true);

    const timer = window.setTimeout(() => {
      void window.pidesk.packages
        .searchCatalog({
          query,
          sort,
          kinds: selectedKinds,
          hasDemoOnly,
        })
        .then((response) => {
          if (cancelled) {
            return;
          }

          setPackages(response.packages);
          setSelectedPackageName((currentSelectedName) => {
            if (
              currentSelectedName &&
              response.packages.some((pkg) => pkg.name === currentSelectedName)
            ) {
              return currentSelectedName;
            }

            return response.packages[0]?.name ?? null;
          });
        })
        .catch((nextError) => {
          if (!cancelled) {
            setError(
              nextError instanceof Error
                ? nextError.message
                : "Failed to load packages",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingCatalog(false);
          }
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasDemoOnly, open, query, selectedKinds, sort]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoadingInstalled(true);

    void window.pidesk.packages
      .listInstalled()
      .then((nextInstalledPackages) => {
        if (!cancelled) {
          setInstalledPackages(nextInstalledPackages);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load installed packages",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingInstalled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !selectedPackageName) {
      setSelectedPackageDetail(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);

    void window.pidesk.packages
      .getPackageDetail(selectedPackageName)
      .then((detail) => {
        if (!cancelled) {
          setSelectedPackageDetail(detail);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load package detail",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedPackageName]);

  const toggleKind = React.useCallback((kind: PackageKind) => {
    setSelectedKinds((currentKinds) =>
      currentKinds.includes(kind)
        ? currentKinds.filter((currentKind) => currentKind !== kind)
        : [...currentKinds, kind],
    );
  }, []);

  const installPackage = React.useCallback(
    async (packageName: string, scope: PackageInstallScope) => {
      const operation = await window.pidesk.packages.install({
        packageName,
        scope,
      });
      setActiveOperation(operation);
    },
    [],
  );

  const removePackage = React.useCallback(
    async (packageName: string, scope: PackageInstallScope) => {
      const operation = await window.pidesk.packages.remove({
        packageName,
        scope,
      });
      setActiveOperation(operation);
    },
    [],
  );

  const updatePackage = React.useCallback(
    async (packageName: string | undefined, scope: PackageInstallScope) => {
      const operation = await window.pidesk.packages.update({
        packageName,
        scope,
      });
      setActiveOperation(operation);
    },
    [],
  );

  return {
    query,
    setQuery,
    sort,
    setSort,
    selectedScope,
    setSelectedScope,
    selectedTab,
    setSelectedTab,
    selectedKinds,
    toggleKind,
    hasDemoOnly,
    setHasDemoOnly,
    status,
    hasActiveWorktree,
    packages,
    selectedPackageName,
    setSelectedPackageName,
    selectedPackageDetail,
    installedPackages,
    activeOperation,
    isLoadingCatalog,
    isLoadingInstalled,
    isLoadingDetail,
    error,
    installPackage,
    removePackage,
    updatePackage,
  };
}
