import { toast as sonnerToast } from "sonner";

// App-styled toast utility with consistent dark aesthetic
// Matches the Pi Desktop design system

const TOAST_STYLE = {
  background: "var(--color-bg-secondary)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "6px",
  color: "rgba(255, 255, 255, 0.85)",
  fontSize: "13px",
  fontWeight: 400,
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
};

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  description?: string;
  duration?: number;
}

function show(message: string, type: ToastType, options: ToastOptions = {}) {
  const { description, duration = 3000 } = options;

  const iconColor = {
    success: "var(--color-success)",
    error: "var(--color-error)",
    info: "var(--color-info)",
    warning: "var(--color-warning)",
  }[type];

  const content = (
    <div className="flex items-start gap-3">
      <span
        className="mt-[1px] block size-2 shrink-0"
        style={{ backgroundColor: iconColor }}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-[16px] leading-none">{message}</span>
        {description && (
          <span className="text-[14px] text-white/50 leading-none">
            {description}
          </span>
        )}
      </div>
    </div>
  );

  return sonnerToast(content, {
    duration,
    style: TOAST_STYLE,
  });
}

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    show(message, "success", options),
  error: (message: string, options?: ToastOptions) =>
    show(message, "error", options),
  info: (message: string, options?: ToastOptions) =>
    show(message, "info", options),
  warning: (message: string, options?: ToastOptions) =>
    show(message, "warning", options),
};
