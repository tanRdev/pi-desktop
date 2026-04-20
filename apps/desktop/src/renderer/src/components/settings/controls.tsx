import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Low-profile form row used by every settings section. Label on the left,
 * control on the right. Avoids nested cards per project guidance.
 */
export function SettingsRow({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-normal text-white/80"
        >
          {label}
        </label>
        {description ? (
          <p className="text-[10.5px] text-white/40 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-2">
        <h2 className="text-[12px] font-normal text-white/90">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[10.5px] text-white/40">{description}</p>
        ) : null}
      </div>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  );
}

export function SettingsToggle({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 items-center border transition-colors",
        checked
          ? "bg-white/60 border-white/60"
          : "bg-white/[0.06] border-white/[0.08] hover:border-white/[0.14]",
      )}
    >
      <span
        className={cn(
          "inline-block h-2.5 w-2.5 transform transition-transform",
          checked
            ? "translate-x-3.5 bg-[var(--color-bg-secondary)]"
            : "translate-x-0.5 bg-white/60",
        )}
      />
    </button>
  );
}

export function SettingsSelect({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "min-w-[140px] border border-white/[0.08] bg-[var(--color-bg-primary)] px-2 py-1 text-[10.5px] text-white/80 outline-none",
        "transition-colors hover:border-white/[0.14] focus:border-white/[0.2]",
      )}
    >
      {options.map((opt) => (
        <option
          key={opt.value}
          value={opt.value}
          className="bg-[var(--color-bg-secondary)]"
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function SettingsNumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  id?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className={cn(
          "w-20 border border-white/[0.08] bg-[var(--color-bg-primary)] px-2 py-1 text-[10.5px] text-white/80 outline-none",
          "transition-colors hover:border-white/[0.14] focus:border-white/[0.2]",
        )}
      />
      {suffix ? (
        <span className="text-[10.5px] text-white/40">{suffix}</span>
      ) : null}
    </div>
  );
}

export function SettingsTextInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-[200px] border border-white/[0.08] bg-[var(--color-bg-primary)] px-2 py-1 text-[10.5px] text-white/80 outline-none",
        "transition-colors hover:border-white/[0.14] focus:border-white/[0.2]",
        "placeholder:text-white/30",
      )}
    />
  );
}
