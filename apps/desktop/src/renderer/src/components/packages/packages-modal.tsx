import { Button } from "@/components/ui/button";
import {
  ArrowClockwise,
  Code,
  DownloadSimple,
  Globe,
  Link,
  MagnifyingGlass,
  Package,
  Trash,
} from "@/components/ui/icons";
import {
  PACKAGE_KIND_OPTIONS,
  usePackagesController,
} from "@/hooks/use-packages-controller";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Markdown } from "../ui/markdown";
import { ScrollArea } from "../ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface PackagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackagesModal({ open, onOpenChange }: PackagesModalProps) {
  const controller = usePackagesController({ open });
  const selectedInstalledPackage = controller.installedPackages.find(
    (pkg) => pkg.name === controller.selectedPackageName,
  );
  const installDisabled =
    controller.selectedScope === "local" && !controller.hasActiveWorktree;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] w-[min(860px,calc(100vw-40px))] max-w-[860px] flex-col gap-0 overflow-hidden rounded-lg border border-white/[0.06] bg-[var(--color-bg-tertiary)] p-0 shadow-[0_24px_48px_rgba(0,0,0,0.5)] outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/[0.06] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="space-y-0.5">
            <p className="text-[14px] font-medium uppercase tracking-[0.18em] text-white/40">
              Extensions
            </p>
            <DialogTitle className="font-heading text-[20px] font-semibold tracking-[-0.02em] text-white/90">
              Packages
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-sm bg-white/[0.03] px-3 text-white/60 focus-within:bg-white/[0.05] transition-colors">
              <MagnifyingGlass className="size-5 text-white/30" />
              <input
                type="search"
                value={controller.query}
                onChange={(event) => controller.setQuery(event.target.value)}
                placeholder="Search packages..."
                className="w-full bg-transparent text-sm text-white/80 outline-none ring-0 placeholder:text-white/20 focus:outline-none focus-visible:outline-none"
              />
            </div>
            <Select
              value={controller.selectedTab}
              onValueChange={(value) => controller.setSelectedTab(value as any)}
            >
              <SelectTrigger className="h-9 min-w-[110px] border-none bg-white/[0.03] text-white/60 transition-colors hover:bg-white/[0.05]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="browse">Browse</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={controller.sort}
              onValueChange={(value) => {
                if (
                  value === "downloads" ||
                  value === "recent" ||
                  value === "name"
                ) {
                  controller.setSort(value as any);
                }
              }}
            >
              <SelectTrigger className="h-9 min-w-[160px] border-none bg-white/[0.03] text-white/60 transition-colors hover:bg-white/[0.05]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="downloads">Most downloads</SelectItem>
                <SelectItem value="recent">Recently published</SelectItem>
                <SelectItem value="name">A-Z</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={controller.selectedScope}
              onValueChange={(value) => {
                if (value === "local" || value === "global") {
                  controller.setSelectedScope(value);
                }
              }}
            >
              <SelectTrigger className="h-9 min-w-[100px] border-none bg-white/[0.03] text-white/60 transition-colors hover:bg-white/[0.05]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {installDisabled ? (
            <p className="mt-2 text-[14px] text-white/25">
              Local install is unavailable until a project target is selected.
            </p>
          ) : null}
          {controller.error ? (
            <p className="mt-3 text-xs font-medium text-red-400/70">
              {controller.error}
            </p>
          ) : null}
          {controller.activeOperation ? (
            <div className="mt-3 flex items-center gap-2 text-[14px] text-white/40">
              <div className="size-1 animate-pulse rounded-full bg-blue-400" />
              <span>
                {controller.activeOperation.kind}{" "}
                <span className="font-medium text-white/60">
                  {controller.activeOperation.packageName}
                </span>
                : {controller.activeOperation.message}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
            <ScrollArea className="bg-transparent">
              <div className="space-y-1 py-2">
                {controller.selectedTab === "browse"
                  ? controller.isLoadingCatalog &&
                    controller.packages.length === 0
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="px-4 py-4 space-y-2 animate-pulse"
                        >
                          <div className="h-4 w-2/3 rounded bg-white/[0.03]" />
                          <div className="h-3 w-full rounded bg-white/[0.02]" />
                          <div className="h-3 w-1/2 rounded bg-white/[0.02]" />
                        </div>
                      ))
                    : controller.packages.map((pkg) => {
                        const isSelected =
                          controller.selectedPackageName === pkg.name;
                        return (
                          <button
                            key={pkg.name}
                            type="button"
                            onClick={() =>
                              controller.setSelectedPackageName(pkg.name)
                            }
                            className={cn(
                              "flex w-full flex-col px-4 py-4 text-left transition-colors outline-none ring-0 focus:outline-none focus-visible:outline-none",
                              isSelected
                                ? "bg-white/[0.06]"
                                : "hover:bg-white/[0.04]",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-white/85">
                                {pkg.name}
                              </span>
                              <span className="text-[14px] tabular-nums text-white/30">
                                {pkg.downloads.toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-white/40">
                              {pkg.description || "No description provided."}
                            </p>
                          </button>
                        );
                      })
                  : controller.isLoadingInstalled &&
                      controller.installedPackages.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="px-4 py-4 space-y-2 animate-pulse"
                        >
                          <div className="h-4 w-1/2 rounded bg-white/[0.03]" />
                          <div className="h-3 w-1/3 rounded bg-white/[0.02]" />
                        </div>
                      ))
                    : controller.installedPackages.map((pkg) => (
                        <button
                          key={`${pkg.scope}-${pkg.source}`}
                          type="button"
                          onClick={() =>
                            controller.setSelectedPackageName(pkg.name)
                          }
                          className={cn(
                            "flex w-full flex-col px-4 py-4 text-left transition-colors outline-none ring-0 focus:outline-none focus-visible:outline-none",
                            controller.selectedPackageName === pkg.name
                              ? "bg-white/[0.06]"
                              : "hover:bg-white/[0.04]",
                          )}
                        >
                          <span className="text-sm font-medium text-white/85">
                            {pkg.name}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[14px] font-medium uppercase tracking-wider text-white/30">
                              {pkg.scope}
                            </span>
                            <span className="truncate text-[14px] text-white/20">
                              {pkg.installPath ?? pkg.source}
                            </span>
                          </div>
                        </button>
                      ))}
                {!controller.isLoadingCatalog &&
                !controller.isLoadingInstalled &&
                (controller.selectedTab === "browse"
                  ? controller.packages.length === 0
                  : controller.installedPackages.length === 0) ? (
                  <div className="px-4 py-12 text-center text-xs text-white/20">
                    No packages found.
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <ScrollArea className="bg-transparent">
              <div className="p-8">
                {controller.selectedPackageDetail ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-md bg-white/[0.04]">
                            <Package className="size-5 text-white/40" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-xl font-semibold tracking-tight text-white/90">
                                {controller.selectedPackageDetail.name}
                              </h2>
                              <div className="flex gap-1.5">
                                {controller.selectedPackageDetail.kinds.map(
                                  (kind) => (
                                    <span
                                      key={kind}
                                      className="rounded-sm bg-white/[0.04] px-2 py-0.5 text-[14px] font-medium uppercase tracking-wider text-white/30"
                                    >
                                      {kind}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-white/30">
                              Version {controller.selectedPackageDetail.version}
                            </p>
                          </div>
                        </div>
                        <p className="max-w-2xl text-[16px] leading-relaxed text-white/50">
                          {controller.selectedPackageDetail.description ||
                            "No description provided."}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          disabled={installDisabled}
                          size="sm"
                          className="h-8 rounded-sm"
                          onClick={() => {
                            if (controller.selectedPackageDetail) {
                              void controller.installPackage(
                                controller.selectedPackageDetail.name,
                                controller.selectedScope,
                              );
                            }
                          }}
                        >
                          <DownloadSimple className="size-5" />
                          Install
                        </Button>
                        {selectedInstalledPackage ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 rounded-sm"
                              onClick={() => {
                                if (controller.selectedPackageDetail) {
                                  void controller.updatePackage(
                                    controller.selectedPackageDetail.name,
                                    selectedInstalledPackage.scope,
                                  );
                                }
                              }}
                            >
                              <ArrowClockwise className="size-5" />
                              Update
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-sm text-white/30 hover:bg-red-500/10 hover:text-red-400"
                              onClick={() => {
                                if (controller.selectedPackageDetail) {
                                  void controller.removePackage(
                                    controller.selectedPackageDetail.name,
                                    selectedInstalledPackage.scope,
                                  );
                                }
                              }}
                            >
                              <Trash className="size-5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-8 flex items-center gap-3">
                      <a
                        href={controller.selectedPackageDetail.npmUrl}
                        onClick={(event) => {
                          event.preventDefault();
                          const packageDetail =
                            controller.selectedPackageDetail;
                          if (!packageDetail) {
                            return;
                          }

                          void window.pidesk.dialog.openExternal(
                            packageDetail.npmUrl,
                          );
                        }}
                        className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-white/[0.04] px-3 text-[14px] font-medium tracking-wider text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/70"
                      >
                        <Package className="size-3" />
                        NPM REGISTRY
                      </a>
                      {controller.selectedPackageDetail.repositoryUrl ? (
                        <a
                          href={controller.selectedPackageDetail.repositoryUrl}
                          onClick={(event) => {
                            event.preventDefault();
                            const packageDetail =
                              controller.selectedPackageDetail;
                            if (!packageDetail?.repositoryUrl) {
                              return;
                            }

                            void window.pidesk.dialog.openExternal(
                              packageDetail.repositoryUrl,
                            );
                          }}
                          className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-white/[0.04] px-3 text-[14px] font-medium tracking-wider text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/70"
                        >
                          <Code className="size-3" />
                          SOURCE CODE
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-8">
                      <div className="mb-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/[0.04]" />
                        <span className="text-[14px] font-semibold uppercase tracking-[0.18em] text-white/20">
                          README
                        </span>
                        <div className="h-px flex-1 bg-white/[0.04]" />
                      </div>
                      {controller.isLoadingDetail ? (
                        <div className="space-y-4 animate-pulse">
                          <div className="h-4 w-full rounded bg-white/[0.02]" />
                          <div className="h-4 w-5/6 rounded bg-white/[0.02]" />
                          <div className="h-4 w-4/6 rounded bg-white/[0.02]" />
                        </div>
                      ) : controller.selectedPackageDetail.readmeMarkdown ? (
                        <Markdown className="prose-sm prose-invert max-w-none">
                          {controller.selectedPackageDetail.readmeMarkdown}
                        </Markdown>
                      ) : (
                        <div className="py-12 text-center text-xs text-white/20">
                          No README provided for this package.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-white/20">
                    <Package className="size-8 opacity-20" />
                    <p className="text-xs">Select a package to view details</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
