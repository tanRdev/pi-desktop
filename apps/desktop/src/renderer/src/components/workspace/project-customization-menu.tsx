import { Palette } from "@phosphor-icons/react";
import type {
  RepositoryDisplayMetadata,
  RepositorySnapshot,
} from "@pidesk/shared";
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
            "w-80 rounded-sm border border-white/[0.06] bg-[var(--color-bg-secondary)] p-4 shadow-none",
            "transition-all duration-100",
          )}
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="project-custom-name"
                className="text-[14px] font-medium uppercase tracking-wider text-white/30"
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
                  className="w-full bg-transparent border-b border-white/[0.06] p-2 text-[14px] font-mono text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/[0.12] transition-colors"
                  aria-label="Project display name"
                />
                <p className="mt-1.5 text-[9px] text-white/20">
                  Leave empty to use folder name.
                </p>
              </div>
            </div>

            <div>
              <div className="text-[14px] font-medium uppercase tracking-wider text-white/30">
                Icon
              </div>
              <Button
                type="button"
                variant="outline"
                size="default"
                className={cn(
                  "mt-2 h-10 w-full justify-between rounded-sm border-white/[0.06] bg-transparent px-3 text-left text-white/50 hover:bg-white/[0.04] hover:border-white/[0.08] hover:text-white/70",
                )}
                onClick={() => setIconPickerOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-white/[0.06] bg-white/[0.02]">
                    <currentIcon.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[14px] font-mono uppercase tracking-wider">
                    {currentIcon.label}
                  </span>
                </span>
                <span className="text-[9px] font-mono text-white/20 uppercase tracking-wider">
                  Change
                </span>
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Palette className="h-3 w-3 text-white/30" />
                <span className="text-[14px] font-medium uppercase tracking-wider text-white/30">
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
                        "flex items-center gap-2 rounded-sm border px-2 py-1.5 text-[9px] font-mono uppercase tracking-wider",
                        "transition-all duration-150",
                        isActive
                          ? "border-white/[0.12] bg-white/[0.06] text-white/80"
                          : "border-white/[0.04] bg-transparent text-white/30 hover:border-white/[0.08] hover:text-white/50",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
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
