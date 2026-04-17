import type { ProviderSnapshot } from "@pi-desktop/shared";
import { Skeleton } from "boneyard-js/react";
import * as React from "react";
import { CaretDown, Plus, Star } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { getProviderDisplayName, ProviderIcon } from "../../ui/provider-icon";

export interface ModelPickerProps {
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  isSwitchingModel: boolean;
  disabled: boolean;
  favoriteModels: string[];
  onModelSelection: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void | Promise<void>;
  onModelMenuOpenChange?: (open: boolean) => void | Promise<void>;
  onConnectProvider?: () => void;
  onToggleFavorite?: (modelValue: string) => void;
}

/**
 * Synthesize a minimal ChangeEvent-like object so the existing
 * `onModelSelection` API keeps working without a hidden DOM <select>.
 */
function makeSyntheticSelectEvent(
  value: string,
): React.ChangeEvent<HTMLSelectElement> {
  const target = { value } as HTMLSelectElement;
  return {
    target,
    currentTarget: target,
  } as React.ChangeEvent<HTMLSelectElement>;
}

export function ModelPicker({
  providerSnapshots,
  currentModelValue,
  isSwitchingModel,
  disabled,
  favoriteModels,
  onModelSelection,
  onModelMenuOpenChange,
  onConnectProvider,
  onToggleFavorite,
}: ModelPickerProps) {
  const [open, setOpen] = React.useState(false);

  const favoriteSet = React.useMemo(
    () => new Set(favoriteModels),
    [favoriteModels],
  );

  const favoriteModelsList = React.useMemo(() => {
    const results: {
      providerId: string;
      modelId: string;
      modelName: string;
      value: string;
    }[] = [];
    for (const favValue of favoriteModels) {
      for (const provider of providerSnapshots) {
        const model = provider.models.find(
          (m) => `${provider.id}::${m.id}` === favValue,
        );
        if (model) {
          results.push({
            providerId: provider.id,
            modelId: model.id,
            modelName: model.name,
            value: favValue,
          });
        }
      }
    }
    return results;
  }, [favoriteModels, providerSnapshots]);

  const currentModel = React.useMemo(() => {
    for (const provider of providerSnapshots) {
      for (const model of provider.models) {
        if (`${provider.id}::${model.id}` === currentModelValue) {
          return model;
        }
      }
    }
    return null;
  }, [providerSnapshots, currentModelValue]);

  const currentModelDisplay = currentModel?.name ?? "Select model";

  const handleSelect = React.useCallback(
    (value: string) => {
      void onModelSelection(makeSyntheticSelectEvent(value));
      setOpen(false);
    },
    [onModelSelection],
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        void onModelMenuOpenChange?.(nextOpen);
      }
    },
    [onModelMenuOpenChange],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="model-selector-trigger"
          disabled={
            disabled || isSwitchingModel || providerSnapshots.length === 0
          }
          className={cn(
            "flex items-center gap-1 px-1 py-0.5 text-[11px] text-white/60",
            "transition-all duration-[var(--duration-fast)]",
            "hover:text-white/90 hover:bg-white/[0.04]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
            "disabled:opacity-50",
          )}
        >
          <span className="max-w-[140px] truncate text-[11px]">
            {currentModelDisplay}
          </span>
          <CaretDown
            className={cn(
              "size-3 transition-transform duration-[var(--duration-fast)] ease-out",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-64 border border-white/[0.06] bg-[var(--color-bg-primary)] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
      >
        <div className="max-h-72 overflow-y-auto">
          <Skeleton
            name="model-list"
            loading={isSwitchingModel}
            fixture={
              <div className="space-y-1">
                <div className="h-8 w-full bg-white/5" />
                <div className="my-1 h-px bg-white/[0.04]" />
                <div className="h-8 w-full bg-white/5" />
                <div className="h-8 w-full bg-white/5" />
                <div className="h-8 w-full bg-white/5" />
              </div>
            }
          >
            <button
              type="button"
              onClick={() => {
                onConnectProvider?.();
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[10.5px] transition-colors",
                "text-white/50 hover:bg-white/[0.04] hover:text-white/90",
              )}
            >
              <Plus className="size-4" />
              <span>Connect provider</span>
            </button>
            <div className="my-1 h-px bg-white/[0.04]" />
            {favoriteModelsList.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[11px] font-light uppercase tracking-wider text-white/30">
                  Favorites
                </div>
                {favoriteModelsList.map((fav) => {
                  const isSelected = fav.value === currentModelValue;
                  return (
                    <button
                      key={`fav-${fav.value}`}
                      type="button"
                      data-testid={`model-option-${fav.providerId}-${fav.modelId}`}
                      onClick={() => handleSelect(fav.value)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[10.5px] transition-colors",
                        isSelected
                          ? "bg-white/[0.08] text-white"
                          : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      <ProviderIcon
                        providerId={fav.providerId}
                        className="shrink-0"
                      />
                      <span className="truncate">{fav.modelName}</span>
                      <button
                        type="button"
                        data-testid={`toggle-favorite-${fav.providerId}-${fav.modelId}`}
                        className="ml-auto shrink-0 p-0.5 text-amber-400/80 hover:text-amber-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite?.(fav.value);
                        }}
                      >
                        <Star weight="fill" className="size-3.5" />
                      </button>
                      {isSelected && <SelectedCheck />}
                    </button>
                  );
                })}
                <div className="my-1 h-px bg-white/[0.04]" />
              </>
            )}
            {providerSnapshots.map((provider) => {
              const nonFavoriteModels = provider.models.filter(
                (model) => !favoriteSet.has(`${provider.id}::${model.id}`),
              );
              if (nonFavoriteModels.length === 0) return null;

              return (
                <div key={provider.id}>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-light uppercase tracking-wider text-white/30">
                    <ProviderIcon
                      providerId={provider.id}
                      className="shrink-0"
                    />
                    <span>{getProviderDisplayName(provider.id)}</span>
                  </div>
                  {nonFavoriteModels.map((model) => {
                    const value = `${provider.id}::${model.id}`;
                    const isSelected = value === currentModelValue;
                    return (
                      <button
                        key={`${provider.id}:${model.id}`}
                        type="button"
                        data-testid={`model-option-${provider.id}-${model.id}`}
                        onClick={() => handleSelect(value)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[10.5px] transition-colors",
                          isSelected
                            ? "bg-white/[0.08] text-white"
                            : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                        )}
                      >
                        <span className="truncate">{model.name}</span>
                        <button
                          type="button"
                          data-testid={`toggle-favorite-${provider.id}-${model.id}`}
                          className="ml-auto shrink-0 p-0.5 text-white/20 hover:text-amber-400/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(value);
                          }}
                        >
                          <Star weight="regular" className="size-3.5" />
                        </button>
                        {isSelected && <SelectedCheck />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </Skeleton>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SelectedCheck() {
  return (
    <svg
      className="size-4 text-white/60 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function getCurrentModelName(
  providerSnapshots: ProviderSnapshot[],
  currentModelValue: string,
): string {
  for (const provider of providerSnapshots) {
    for (const model of provider.models) {
      if (`${provider.id}::${model.id}` === currentModelValue) {
        return model.name;
      }
    }
  }
  return "Select model";
}
