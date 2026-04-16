import { Info, Sparkle, Warning } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "@/lib/utils";

type SystemMessageTone = "info" | "success" | "warning" | "error";

const toneMap: Record<
  SystemMessageTone,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  info: {
    icon: Info,
    className: "border-white/[0.05] bg-white/[0.02] text-white/50",
  },
  success: {
    icon: Sparkle,
    className: "border-[#00E559]/20 bg-[#00E559]/[0.04] text-[#00E559]/80",
  },
  warning: {
    icon: Warning,
    className: "border-amber-500/20 bg-amber-500/[0.04] text-amber-400/80",
  },
  error: {
    icon: Warning,
    className: "border-red-500/20 bg-red-500/[0.04] text-red-400/80",
  },
};

export interface SystemMessageProps
  extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SystemMessageTone;
  title?: string;
}

export function SystemMessage({
  tone = "info",
  title,
  className,
  children,
  ...props
}: SystemMessageProps) {
  const { icon: Icon, className: toneClassName } = toneMap[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-3 border px-4 py-3 select-none",
        toneClassName,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1 select-none">
        {title ? (
          <div className="text-xs font-normal uppercase text-white/50">
            {title}
          </div>
        ) : null}
        <div className="text-sm leading-normal text-white/60">{children}</div>
      </div>
    </div>
  );
}
