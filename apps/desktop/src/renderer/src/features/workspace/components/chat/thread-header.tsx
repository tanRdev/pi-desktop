import type { ProviderSnapshot } from "@pi-desktop/shared";
import * as React from "react";
import { CaretDown } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface InlineModelPickerProps {
  providerSnapshots?: ProviderSnapshot[];
  currentModelValue?: string;
  disabled?: boolean;
  onSelectModel?: (value: string) => void;
  className?: string;
}

/**
 * Lightweight inline model picker shown in the chat thread header.
 *
 * Intentionally minimal: rendering is gated on having at least one provider
 * snapshot and the handler. If any piece is missing we render nothing, so the
 * surrounding UI stays identical for hosts that haven't wired model state yet.
 */
export function InlineModelPicker({
  providerSnapshots,
  currentModelValue,
  disabled,
  onSelectModel,
  className,
}: InlineModelPickerProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const currentModel = React.useMemo(() => {
    if (!providerSnapshots || !currentModelValue) return null;
    for (const provider of providerSnapshots) {
      for (const model of provider.models) {
        if (`${provider.id}::${model.id}` === currentModelValue) {
          return { provider, model };
        }
      }
    }
    return null;
  }, [providerSnapshots, currentModelValue]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  if (!providerSnapshots || providerSnapshots.length === 0 || !onSelectModel) {
    return null;
  }

  const label = currentModel?.model.name ?? "Select model";

  return (
    <div
      ref={containerRef}
      data-testid="inline-model-picker"
      className={cn("relative inline-flex", className)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-6 items-center gap-1 border border-white/[0.06] bg-white/[0.01] px-2",
          "font-mono text-[10px] uppercase tracking-wider text-white/60",
          "transition-colors duration-[var(--duration-fast)]",
          "hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/90",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          open && "border-white/[0.12] bg-white/[0.04] text-white/90",
        )}
      >
        <span className="max-w-[160px] truncate">{label}</span>
        <CaretDown
          className={cn(
            "size-2.5 transition-transform text-white/30",
            open && "rotate-180 text-white/60",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className={cn(
            "absolute right-0 top-7 z-20 min-w-[12rem] max-h-72 overflow-auto",
            "border border-white/[0.08] bg-[var(--color-bg-primary)] p-1 shadow-lg",
          )}
        >
          {providerSnapshots.map((provider) => (
            <div key={provider.id} className="mb-1 last:mb-0">
              <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/30">
                {provider.name}
              </div>
              {provider.models.map((model) => {
                const value = `${provider.id}::${model.id}`;
                const isSelected = value === currentModelValue;
                return (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`inline-model-option-${provider.id}-${model.id}`}
                    onClick={() => {
                      onSelectModel(value);
                      setOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectModel(value);
                        setOpen(false);
                      }
                    }}
                    className={cn(
                      "block w-full px-2 py-1.5 text-left text-[11px]",
                      "transition-colors",
                      isSelected
                        ? "bg-white/[0.08] text-white"
                        : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    {model.name}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface ThreadHeaderProps {
  title: string;
  modelPicker?: InlineModelPickerProps;
  className?: string;
}

/**
 * Compact header above the chat transcript. Renders thread title on the left
 * and an inline model picker on the right when configured.
 */
export function ThreadHeader({
  title,
  modelPicker,
  className,
}: ThreadHeaderProps) {
  return (
    <div
      data-testid="chat-thread-header"
      className={cn(
        "mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 py-2",
        "border-b border-white/[0.04]",
        className,
      )}
    >
      <div className="min-w-0 truncate font-mono text-[11px] uppercase tracking-wider text-white/50">
        {title}
      </div>
      {modelPicker ? <InlineModelPicker {...modelPicker} /> : null}
    </div>
  );
}
