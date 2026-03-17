import { HugeiconsIcon, RotateCcw } from "@/components/ui/icons";
import type React from "react";
import { Button } from "../ui/button";

interface SelectOption {
  value: string;
  label: string;
}

// Settings Section wrapper
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

// Settings Row wrapper
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

// Select dropdown
interface SettingsSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[] | SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function SettingsSelect({
  value,
  onChange,
  options,
  disabled = false,
}: SettingsSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Switch toggle
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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow ring-0 transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Slider
interface SettingsSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  showValue?: boolean;
  disabled?: boolean;
}

export function SettingsSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  showValue = true,
  disabled = false,
}: SettingsSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-[120px] h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50"
      />
      {showValue && (
        <span className="w-10 text-right text-xs text-muted-foreground">
          {value}
        </span>
      )}
    </div>
  );
}

// Text Input
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
      className={`${className} flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50`}
    />
  );
}

// Number Input
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
      className={`${className} flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50`}
    />
  );
}

// Divider
export function SettingsDivider() {
  return <div className="border-t border-border my-4" />;
}

// Reset Button
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
      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <RotateCcw className="mr-1 h-3 w-3" />
      {label}
    </Button>
  );
}

// Textarea
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
      className={`${className} rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
    />
  );
}
