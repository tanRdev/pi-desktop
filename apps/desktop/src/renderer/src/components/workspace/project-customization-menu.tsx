import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
} from "@pidesk/shared";
import { Palette } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  PROJECT_ACCENT_OPTIONS,
  resolveProjectAccentOption,
} from "./project-avatar";
import {
  ProjectIconPicker,
  resolveProjectIconOption,
} from "./project-icon-picker";

function getFallbackRepositoryName(rootPath: string): string {
  const segments = rootPath.split(/[\\/]+/).filter(Boolean);
  return segments[segments.length - 1] ?? rootPath;
}

export interface ProjectCustomizationMenuProps {
  repository: RepositorySnapshot;
  open?: boolean;
  updateRepositoryPreferences: (
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ) => void | Promise<void>;
  side?: "left" | "right";
  className?: string;
}

export function ProjectCustomizationMenu({
  repository,
  open = false,
  updateRepositoryPreferences,
  side = "right",
  className,
}: ProjectCustomizationMenuProps) {
  const [iconPickerOpen, setIconPickerOpen] = React.useState(false);
  const [customName, setCustomName] = React.useState(
    repository.customName ?? "",
  );
  const fallbackName = React.useMemo(
    () => getFallbackRepositoryName(repository.rootPath),
    [repository.rootPath],
  );
  const currentIcon = resolveProjectIconOption(
    repository.icon,
    repository.name,
  );
  const currentAccent = resolveProjectAccentOption(repository.accentColor);

  React.useEffect(() => {
    setCustomName(repository.customName ?? "");
  }, [repository.customName]);

  const commitCustomName = React.useCallback(async () => {
    const trimmed = customName.trim();
    const nextCustomName =
      trimmed.length === 0 || trimmed === fallbackName ? null : trimmed;

    if (nextCustomName === (repository.customName ?? null)) {
      return;
    }

    await updateRepositoryPreferences(repository.id, {
      customName: nextCustomName,
    });
  }, [
    customName,
    fallbackName,
    repository.customName,
    repository.id,
    updateRepositoryPreferences,
  ]);

  return (
    <>
      <fieldset
        aria-label={`Customize ${repository.name}`}
        aria-hidden={open ? undefined : true}
        className={cn(
          "min-w-0 border-0 p-0",
          "transition-all duration-[var(--duration-normal)] motion-reduce:transition-none",
          open
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0",
          side === "right"
            ? open
              ? "translate-x-0"
              : "-translate-x-2"
            : open
              ? "translate-x-0"
              : "translate-x-2",
          className,
        )}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
        onMouseLeave={() => {
          void commitCustomName();
        }}
      >
        <div
          className={cn(
            "w-80 rounded-none border border-[#474747]/30 bg-[#131313] p-4 shadow-none",
            "transition-all duration-100",
          )}
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="project-custom-name"
                className="text-[10px] font-bold uppercase tracking-[0.15em] font-headline text-[#474747]"
              >
                Display Name
              </label>
              <div className="mt-2">
                <input
                  id="project-custom-name"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  onBlur={() => {
                    void commitCustomName();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitCustomName();
                    }
                  }}
                  placeholder={fallbackName}
                  className="w-full bg-[#0e0e0e] border border-[#474747]/20 p-2 text-[12px] font-mono text-white placeholder:text-[#474747]/50 focus:outline-none focus:border-white transition-colors uppercase"
                  aria-label="Project display name"
                />
                <p className="mt-1.5 text-[9px] font-mono text-[#474747] uppercase tracking-tight">
                  EMPTY FOR FOLDER NAME.
                </p>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] font-headline text-[#474747]">
                Icon
              </div>
              <Button
                type="button"
                variant="outline"
                size="default"
                className={cn(
                  "mt-2 h-10 w-full justify-between rounded-none border-[#474747]/30 bg-[#0e0e0e] px-3 text-left hover:bg-[#1f1f1f] hover:border-[#474747]",
                )}
                onClick={() => setIconPickerOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-none border border-[#474747]/30 bg-[#131313]">
                    <currentIcon.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider">
                    {currentIcon.label}
                  </span>
                </span>
                <span className="text-[9px] font-mono text-[#474747] uppercase tracking-widest">
                  Change
                </span>
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Palette className="h-3 w-3 text-[#474747]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] font-headline text-[#474747]">
                  Accent Color
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {PROJECT_ACCENT_OPTIONS.map((option) => {
                  const isActive = option.value === currentAccent.value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        void updateRepositoryPreferences(repository.id, {
                          accentColor: option.value,
                        });
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-none border px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest",
                        "transition-all duration-75",
                        isActive
                          ? "border-white bg-[#353535] text-white"
                          : "border-[#474747]/30 bg-[#0e0e0e] text-[#474747] hover:border-white hover:text-white",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-none"
                        style={{ backgroundColor: option.swatch }}
                      />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      <ProjectIconPicker
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        repositoryName={repository.name}
        value={repository.icon}
        onSelect={(iconId) =>
          updateRepositoryPreferences(repository.id, {
            icon: iconId,
          })
        }
      />
    </>
  );
}
