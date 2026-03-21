import type React from "react";
import { HugeiconsIcon, RotateCcw } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

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
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
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
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
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
  return (
    <select
      data-testid={testId}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "hover:border-border-hover",
        "active:scale-[0.99]",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
          "w-[120px] h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary",
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:opacity-50",
        )}
        style={{ transitionTimingFunction: EASE_OUT }}
      />
      {showValue && (
        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
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
        "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
        "transition-all duration-150",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "hover:border-border-hover",
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
        "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "hover:border-border-hover",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    />
  );
}

export function SettingsDivider() {
  return <div className="border-t border-border my-4" />;
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
        "h-7 px-2 text-xs text-muted-foreground hover:text-foreground",
        "transition-all duration-150",
        "hover:bg-surface-2",
        "active:scale-[0.97]",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    >
      <RotateCcw className="mr-1 h-3 w-3" />
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
        "rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "transition-all duration-150",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "hover:border-border-hover",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      style={{ transitionTimingFunction: EASE_OUT }}
    />
  );
}
