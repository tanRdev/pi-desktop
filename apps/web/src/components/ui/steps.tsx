import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed" | "error";
}

export interface StepsProps {
  steps: Step[];
  className?: string;
}

export function Steps({ steps, className }: StepsProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isActive = step.status === "in-progress";
        const isCompleted = step.status === "completed";
        const hasError = step.status === "error";

        return (
          <div key={step.id} className="group relative flex gap-3">
            {/* Line */}
            {!isLast && (
              <div className="absolute left-[9px] top-6 h-[calc(100%-16px)] w-px bg-white/[0.06]" />
            )}

            {/* Icon */}
            <div className="relative z-10 flex shrink-0">
              <div
                className={cn(
                  "flex size-[18px] items-center justify-center rounded-full border transition-colors",
                  isCompleted
                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                    : hasError
                      ? "border-red-500/50 bg-red-500/20 text-red-400"
                      : isActive
                        ? "border-amber-500/50 bg-amber-500/20 text-amber-400"
                        : "border-white/[0.1] bg-white/[0.04] text-zinc-600",
                )}
              >
                {isCompleted ? (
                  <Check className="size-3" />
                ) : hasError ? (
                  <span className="size-1.5 rounded-full bg-red-400" />
                ) : isActive ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Circle className="size-2" />
                )}
              </div>
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-5", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-xs font-medium transition-colors",
                  isActive || isCompleted
                    ? "text-zinc-200"
                    : hasError
                      ? "text-red-400"
                      : "text-zinc-500",
                )}
              >
                {step.title}
              </p>
              {step.description && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface TimelineProps {
  items: Array<{
    id: string;
    title: string;
    timestamp?: string;
    status?: "default" | "success" | "error" | "warning";
  }>;
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {items.map((item) => {
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5",
              item.status === "success" &&
                "border-emerald-500/20 bg-emerald-500/5",
              item.status === "error" && "border-red-500/20 bg-red-500/5",
              item.status === "warning" && "border-amber-500/20 bg-amber-500/5",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  item.status === "success" && "bg-emerald-400",
                  item.status === "error" && "bg-red-400",
                  item.status === "warning" && "bg-amber-400",
                  (!item.status || item.status === "default") && "bg-zinc-600",
                )}
              />
              <span className="text-[11px] text-zinc-400">{item.title}</span>
            </div>
            {item.timestamp && (
              <span className="text-[10px] text-zinc-600">
                {item.timestamp}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
