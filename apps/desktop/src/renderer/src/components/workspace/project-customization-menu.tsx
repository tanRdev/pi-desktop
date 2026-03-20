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
            ? (open ? "translate-x-0" : "-translate-x-2")
            : (open ? "translate-x-0" : "translate-x-2"),
          className,
        )}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
        onMouseLeave={() => {
          void commitCustomName();
        }}
      >
        <div
          className={cn(
            "w-80 rounded-lg border border-border/40 bg-surface-1/96 p-4 shadow-sm",
            "transition-all duration-[var(--duration-normal)] motion-reduce:transition-none",
            open && "shadow-md",
          )}
          style={{ transitionTimingFunction: "var(--ease-out)" }}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="project-custom-name" className="chrome-eyebrow">
                Display name
              </label>
              <div className="mt-2 space-y-2">
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
                  className="project-customization-field"
                  aria-label="Project display name"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank to use the repository folder name.
                </p>
              </div>
            </div>

            <div>
              <div className="chrome-eyebrow">Icon</div>
              <Button
                type="button"
                variant="outline"
                size="default"
                className={cn(
                  "mt-2 h-10 w-full justify-between rounded-xl border-border bg-surface-2 px-3 text-left",
                  "transition-all duration-[var(--duration-fast)] motion-reduce:transition-none",
                  "hover:bg-surface-3 hover:border-border-hover hover:scale-[1.01]",
                  "active:scale-[0.97] motion-reduce:active:scale-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
                style={{ transitionTimingFunction: "var(--ease-out)" }}
                onClick={() => setIconPickerOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-1">
                    <currentIcon.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium">
                    {currentIcon.label}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Choose
                </span>
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="chrome-eyebrow">Accent color</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROJECT_ACCENT_OPTIONS.map((option, index) => {
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
                        "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px]",
                        "transition-all duration-[var(--duration-fast)] motion-reduce:transition-none",
                        "hover:scale-105 active:scale-[0.95] motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        isActive
                          ? "border-border bg-surface-2 text-foreground shadow-sm"
                          : "border-border/70 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground",
                      )}
                      style={{
                        transitionTimingFunction: "var(--ease-out)",
                        animationDelay: `${index * 30}ms`,
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/10 transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none"
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
