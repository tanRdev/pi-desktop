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
  updateRepositoryPreferences: (
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ) => void | Promise<void>;
  side?: "left" | "right";
  className?: string;
}

export function ProjectCustomizationMenu({
  repository,
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
        className={cn(
          "hidden min-w-0 border-0 p-0 group-hover:block group-focus-within:block",
          side === "right" ? "translate-x-1" : "-translate-x-1",
          className,
        )}
        onMouseLeave={() => {
          void commitCustomName();
        }}
      >
        <div className="w-80 rounded-lg border border-border/40 bg-surface-1/96 p-4 shadow-sm">
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
                className="mt-2 h-10 w-full justify-between rounded-xl border-border bg-surface-2 px-3 text-left"
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
                        "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] transition",
                        isActive
                          ? "border-border bg-surface-2 text-foreground"
                          : "border-border/70 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/10"
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
