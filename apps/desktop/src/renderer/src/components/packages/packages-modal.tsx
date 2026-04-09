import { Button } from "@/components/ui/button";
import {
  ArrowClockwise,
  DownloadSimple,
  Globe,
  Link,
  MagnifyingGlass,
  Package,
  Trash,
} from "@/components/ui/icons";
import {
  PACKAGE_KIND_OPTIONS,
  PACKAGE_TABS,
  usePackagesController,
} from "@/hooks/use-packages-controller";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Markdown } from "../ui/markdown";
import { ScrollArea } from "../ui/scroll-area";

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
      <DialogContent className="flex h-[80vh] w-[min(1120px,calc(100vw-40px))] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-md border border-white/[0.06] bg-[#0d0d0d] p-0 shadow-[0_12px_36px_rgba(0,0,0,0.42)] focus:outline-none focus-visible:outline-none">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/[0.06] bg-[#0c0c0c] px-6 py-4">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
              Extensions
            </p>
            <DialogTitle className="font-heading text-[18px] font-semibold tracking-[-0.02em] text-white/90">
              Packages
            </DialogTitle>
          </div>
          {controller.status ? (
            <div className="rounded-sm border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/55">
              {controller.status.cli === "available"
                ? "Pi CLI ready"
                : (controller.status.message ?? "Pi CLI unavailable")}
            </div>
          ) : null}
        </DialogHeader>

        <div className="border-b border-white/[0.06] bg-[#0b0b0b] px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-white/60">
              <MagnifyingGlass className="size-4" />
              <input
                type="search"
                value={controller.query}
                onChange={(event) => controller.setQuery(event.target.value)}
                placeholder="Search packages"
                className="w-full bg-transparent text-sm text-white/80 outline-none ring-0 placeholder:text-white/30 focus:outline-none focus-visible:outline-none"
              />
            </div>
            <select
              value={controller.sort}
              onChange={(event) => {
                const nextSort = event.target.value;
                if (
                  nextSort === "downloads" ||
                  nextSort === "recent" ||
                  nextSort === "name"
                ) {
                  controller.setSort(nextSort);
                }
              }}
              className="appearance-none rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white/70 outline-none ring-0 focus:outline-none focus-visible:outline-none"
            >
              <option value="downloads">Most downloads</option>
              <option value="recent">Recently published</option>
              <option value="name">A-Z</option>
            </select>
            <select
              value={controller.selectedScope}
              onChange={(event) => {
                const nextScope = event.target.value;
                if (nextScope === "local" || nextScope === "global") {
                  controller.setSelectedScope(nextScope);
                }
              }}
              className="appearance-none rounded-sm border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white/70 outline-none ring-0 focus:outline-none focus-visible:outline-none"
            >
              <option value="local">Install locally</option>
              <option value="global">Install globally</option>
            </select>
          </div>
          {installDisabled ? (
            <p className="mt-2 text-[11px] text-white/38">
              Local install is unavailable until a project target is selected.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {PACKAGE_KIND_OPTIONS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => controller.toggleKind(kind)}
                className={cn(
                  "rounded-sm border px-2.5 py-1 text-[11px] transition-colors outline-none ring-0 focus:outline-none focus-visible:outline-none",
                  controller.selectedKinds.includes(kind)
                    ? "border-white/[0.12] bg-white/[0.07] text-white/88"
                    : "border-white/[0.06] bg-transparent text-white/45 hover:bg-white/[0.03] hover:text-white/78",
                )}
              >
                {kind}
              </button>
            ))}
            <button
              type="button"
              onClick={() => controller.setHasDemoOnly(!controller.hasDemoOnly)}
              className={cn(
                "rounded-sm border px-2.5 py-1 text-[11px] transition-colors outline-none ring-0 focus:outline-none focus-visible:outline-none",
                controller.hasDemoOnly
                  ? "border-white/[0.12] bg-white/[0.07] text-white/88"
                  : "border-white/[0.06] bg-transparent text-white/45 hover:bg-white/[0.03] hover:text-white/78",
              )}
            >
              Has demo
            </button>
          </div>
          {controller.error ? (
            <p className="mt-3 text-xs text-red-300/80">{controller.error}</p>
          ) : null}
          {controller.activeOperation ? (
            <p className="mt-3 text-xs text-white/50">
              {controller.activeOperation.kind}{" "}
              {controller.activeOperation.packageName}:{" "}
              {controller.activeOperation.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-1 min-h-0">
          <nav className="w-36 shrink-0 border-r border-white/[0.06] bg-[#0a0a0a] px-2 py-4">
            <div className="flex flex-col gap-1">
              {PACKAGE_TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => controller.setSelectedTab(item)}
                  className={cn(
                    "rounded-sm px-3 py-2 text-left text-sm transition-colors outline-none ring-0 focus:outline-none focus-visible:outline-none",
                    controller.selectedTab === item
                      ? "bg-white/[0.06] text-white/88"
                      : "text-white/40 hover:bg-white/[0.04] hover:text-white/80",
                  )}
                >
                  {item === "browse" ? "Browse" : "Installed"}
                </button>
              ))}
            </div>
          </nav>

          <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr]">
            <ScrollArea className="border-r border-white/[0.06] bg-[#0d0d0d]">
              <div>
                {controller.selectedTab === "browse"
                  ? controller.packages.map((pkg) => {
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
                            "flex w-full flex-col border-b border-white/[0.05] px-4 py-3 text-left transition-colors outline-none ring-0 focus:outline-none focus-visible:outline-none",
                            isSelected
                              ? "bg-white/[0.05]"
                              : "bg-transparent hover:bg-white/[0.025]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-white/85">
                              {pkg.name}
                            </span>
                            <span className="text-[11px] text-white/35">
                              {pkg.downloads.toLocaleString()}/mo
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
                            {pkg.description || "No description provided."}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {pkg.kinds.map((kind) => (
                              <span
                                key={kind}
                                className="rounded-sm border border-white/[0.05] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/40"
                              >
                                {kind}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })
                  : controller.installedPackages.map((pkg) => (
                      <button
                        key={`${pkg.scope}-${pkg.source}`}
                        type="button"
                        onClick={() =>
                          controller.setSelectedPackageName(pkg.name)
                        }
                        className={cn(
                          "flex w-full flex-col border-b border-white/[0.05] px-4 py-3 text-left transition-colors outline-none ring-0 focus:outline-none focus-visible:outline-none",
                          controller.selectedPackageName === pkg.name
                            ? "bg-white/[0.05]"
                            : "bg-transparent hover:bg-white/[0.025]",
                        )}
                      >
                        <span className="text-sm font-medium text-white/85">
                          {pkg.name}
                        </span>
                        <span className="mt-1 text-xs text-white/45">
                          {pkg.scope}
                        </span>
                        <span className="mt-1 truncate text-[11px] text-white/30">
                          {pkg.installPath ?? pkg.source}
                        </span>
                      </button>
                    ))}
                {controller.isLoadingCatalog ||
                controller.isLoadingInstalled ? (
                  <p className="px-4 py-4 text-sm text-white/40">
                    Loading packages...
                  </p>
                ) : null}
              </div>
            </ScrollArea>

            <ScrollArea className="bg-[#0e0e0e]">
              <div className="p-6">
                {controller.selectedPackageDetail ? (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Package className="size-4 text-white/35" />
                          <h2 className="text-lg font-semibold tracking-[-0.02em] text-white/90">
                            {controller.selectedPackageDetail.name}
                          </h2>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                          {controller.selectedPackageDetail.description ||
                            "No description provided."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {controller.selectedPackageDetail.kinds.map(
                            (kind) => (
                              <span
                                key={kind}
                                className="rounded-sm border border-white/[0.05] px-2 py-1 text-[11px] text-white/42"
                              >
                                {kind}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          disabled={installDisabled}
                          className="rounded-sm"
                          onClick={() =>
                            void controller.installPackage(
                              controller.selectedPackageDetail.name,
                              controller.selectedScope,
                            )
                          }
                        >
                          <DownloadSimple className="size-4" />
                          Install
                        </Button>
                        {selectedInstalledPackage ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-sm"
                              onClick={() =>
                                void controller.updatePackage(
                                  controller.selectedPackageDetail?.name,
                                  selectedInstalledPackage.scope,
                                )
                              }
                            >
                              <ArrowClockwise className="size-4" />
                              Update
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-sm"
                              onClick={() =>
                                void controller.removePackage(
                                  controller.selectedPackageDetail?.name,
                                  selectedInstalledPackage.scope,
                                )
                              }
                            >
                              <Trash className="size-4" />
                              Remove
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-4 border-t border-white/[0.05] pt-4 text-xs text-white/40">
                      <span>
                        Version {controller.selectedPackageDetail.version}
                      </span>
                      {controller.selectedPackageDetail.author ? (
                        <span>
                          By {controller.selectedPackageDetail.author}
                        </span>
                      ) : null}
                      <a
                        href={controller.selectedPackageDetail.npmUrl}
                        className="inline-flex items-center gap-1 text-white/55 hover:text-white/78"
                      >
                        <Globe className="size-3.5" />
                        npm
                      </a>
                      {controller.selectedPackageDetail.repositoryUrl ? (
                        <a
                          href={controller.selectedPackageDetail.repositoryUrl}
                          className="inline-flex items-center gap-1 text-white/55 hover:text-white/78"
                        >
                          <Link className="size-3.5" />
                          Repository
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-8 border-t border-white/[0.05] pt-5">
                      <p className="mb-4 text-[11px] uppercase tracking-[0.16em] text-white/35">
                        README Preview
                      </p>
                      {controller.isLoadingDetail ? (
                        <p className="text-sm text-white/40">
                          Loading package details...
                        </p>
                      ) : controller.selectedPackageDetail.readmeMarkdown ? (
                        <Markdown>
                          {controller.selectedPackageDetail.readmeMarkdown}
                        </Markdown>
                      ) : (
                        <p className="text-sm text-white/40">
                          README not available.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/40">
                    Select a package to preview details.
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
