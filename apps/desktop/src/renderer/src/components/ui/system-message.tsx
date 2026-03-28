import { Info, Star as Sparkles, Warning } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "@/lib/utils";

type SystemMessageTone = "info" | "success" | "warning" | "error";

const toneMap: Record<
  SystemMessageTone,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  info: {
    icon: Info,
    className: "border-[#474747]/25 bg-[#111111] text-[#cfcfcf]",
  },
  success: {
    icon: Sparkles,
    className: "border-[#2f6f51]/35 bg-[#0f1712] text-[#c6e6d3]",
  },
  warning: {
    icon: Warning,
    className: "border-[#7c5d2a]/35 bg-[#18130d] text-[#ead7b2]",
  },
  error: {
    icon: Warning,
    className: "border-[#7f4141]/35 bg-[#180f0f] text-[#f0c9c9]",
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
        "flex items-start gap-3 border px-3 py-2.5",
        toneClassName,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title ? (
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-current/80">
            {title}
          </div>
        ) : null}
        <div className="text-[12px] leading-5 text-current">{children}</div>
      </div>
    </div>
  );
}
