import type React from "react";
import { Check, ChevronDown, RotateCcw } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

interface SelectOption {
  value: string;
  label: string;
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <div className="space-y-5 border-b border-white/[0.04] pb-6 last:border-b-0">
      <div className="pb-1">
        <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-white/40">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsRow({
  label,
  description,
  children,
}: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 px-0 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-white/60">{label}</div>
        {description && (
          <p className="mt-1 text-[12px] leading-5 text-white/40">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface SettingsSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[] | SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  ariaLabel?: string;
}

export function SettingsSelect({
  value,
  onChange,
  options,
  disabled = false,
  testId,
  ariaLabel,
}: SettingsSelectProps) {
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0] ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "flex h-10 w-[240px] items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-[#141414] px-3.5 py-1 text-sm text-white/80",
            "transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "hover:border-white/[0.12] hover:bg-white/[0.03]",
            "active:scale-[0.99]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={{ transitionTimingFunction: EASE_OUT }}
        >
          <span className="truncate text-left">
            {selectedOption?.label ?? "Select option"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/30" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[240px] rounded-md border border-white/[0.06] bg-[#111111] p-1"
      >
        <div className="space-y-1">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-[12px] transition-colors",
                  isSelected
                    ? "bg-white text-black"
                    : "text-[#b8b8b8] hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SettingsSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingsSwitch({
  checked,
  onChange,
  disabled = false,
}: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow ring-0",
          "transition-transform duration-150",
          checked ? "translate-x-4" : "translate-x-0",
        )}
        style={{ transitionTimingFunction: EASE_OUT }}
      />
    </button>
  );
}

interface SettingsSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  showValue?: boolean;
  disabled?: boolean;
  testId?: string;
  ariaLabel?: string;
}

export function SettingsSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  showValue = true,
  disabled = false,
  testId,
  ariaLabel,
}: SettingsSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        data-testid={testId}
        aria-label={ariaLabel}
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          "h-2 w-[144px] cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-primary",
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:opacity-50",
        )}
        style={{ transitionTimingFunction: EASE_OUT }}
      />
      {showValue && (
        <span className="w-12 text-right text-[12px] font-medium text-white/40 tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}

interface SettingsInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  disabled?: boolean;
  className?: string;
}

export function SettingsInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
  disabled = false,
  className = "w-[200px]",
}: SettingsInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        className,
        "flex h-9 rounded-md border border-white/[0.06] bg-[#141414] px-3 py-1 text-sm text-white/80 shadow-sm",
        "transition-all duration-150",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/30",
        "focus-visible:outline-none focus-visible:border-white/[0.12] focus-visible:ring-0",
        "hover:border-white/[0.12]",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    />
  );
}

interface SettingsNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

export function SettingsNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  className = "w-[100px]",
}: SettingsNumberInputProps) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        className,
        "flex h-9 rounded-md border border-white/[0.06] bg-[#141414] px-3 py-1 text-sm text-white/80 shadow-sm",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:border-white/[0.12] focus-visible:ring-0",
        "hover:border-white/[0.12]",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    />
  );
}

export function SettingsDivider() {
  return <div className="border-t border-white/[0.04] my-4" />;
}

interface ResetButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

export function ResetButton({
  onClick,
  label = "Reset",
  disabled = false,
}: ResetButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 rounded-md px-3 text-[11px] text-white/40 hover:text-white/60",
        "transition-all duration-150",
        "hover:bg-white/[0.04]",
        "active:scale-[0.97]",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    >
      <RotateCcw className="mr-1 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

interface SettingsTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

export function SettingsTextarea({
  value,
  onChange,
  placeholder = "",
  rows = 3,
  disabled = false,
  className = "w-full",
}: SettingsTextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={cn(
        className,
        "rounded-md border border-white/[0.06] bg-[#141414] px-3 py-2 text-sm text-white/80",
        "transition-all duration-150",
        "placeholder:text-white/30",
        "focus-visible:outline-none focus-visible:border-white/[0.12] focus-visible:ring-0",
        "hover:border-white/[0.12]",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    />
  );
}
