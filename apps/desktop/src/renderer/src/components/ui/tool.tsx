"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  ChevronDown,
  Loader2,
  Settings,
  XCircle,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type ToolPart = {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolCallId?: string;
  errorText?: string;
};

export type ToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
};

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { state, input, output, toolCallId } = toolPart;

  const getStateIcon = () => {
    switch (state) {
      case "input-streaming":
        return (
          <Loader2
            className={cn(
              "h-3.5 w-3.5 animate-spin text-blue-400/60",
              "transition-all duration-[var(--duration-fast)] ease-out",
            )}
          />
        );
      case "input-available":
        return (
          <Settings
            className={cn(
              "h-3.5 w-3.5 text-amber-400/60",
              "transition-all duration-[var(--duration-fast)] ease-out",
            )}
          />
        );
      case "output-available":
        return (
          <CheckCircle
            className={cn(
              "h-3.5 w-3.5 text-white/30",
              "transition-all duration-[var(--duration-fast)] ease-out",
            )}
          />
        );
      case "output-error":
        return (
          <XCircle
            className={cn(
              "h-3.5 w-3.5 text-red-400/80",
              "transition-all duration-[var(--duration-fast)] ease-out",
            )}
          />
        );
      default:
        return (
          <Settings
            className={cn(
              "h-3.5 w-3.5 text-white/20",
              "transition-all duration-[var(--duration-fast)] ease-out",
            )}
          />
        );
    }
  };

  const getStateBadge = () => {
    const baseClasses = cn(
      "px-1.5 py-0.5 rounded text-[11px] font-medium",
      "transition-all duration-[var(--duration-fast)] ease-out",
    );
    switch (state) {
      case "input-streaming":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-blue-500/10 text-blue-400/60",
              "animate-pulse",
            )}
          >
            Processing
          </span>
        );
      case "input-available":
        return (
          <span
            className={cn(baseClasses, "bg-amber-500/10 text-amber-400/60")}
          >
            Ready
          </span>
        );
      case "output-available":
        return (
          <span className={cn(baseClasses, "bg-white/[0.04] text-white/40")}>
            Completed
          </span>
        );
      case "output-error":
        return (
          <span className={cn(baseClasses, "bg-red-500/10 text-red-400/80")}>
            Error
          </span>
        );
      default:
        return (
          <span className={cn(baseClasses, "bg-white/[0.03] text-white/30")}>
            Pending
          </span>
        );
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-lg border border-white/[0.04] bg-white/[0.02]",
        "transition-all duration-[var(--duration-normal)] ease-out",
        "hover:border-white/[0.08]",
        state === "output-error" && "border-red-500/20",
        className,
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "h-auto w-full justify-between rounded-lg px-3 py-2 font-normal",
              "transition-all duration-[var(--duration-fast)] ease-out",
              "hover:bg-white/[0.03]",
              "active:scale-[0.99]",
            )}
          >
            <div className="flex items-center gap-2">
              {getStateIcon()}
              <span className="font-mono text-sm font-medium text-white/60">
                {toolPart.type}
              </span>
              {getStateBadge()}
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-white/20 transition-transform duration-[var(--duration-normal)] ease-out",
                isOpen && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            "border-t border-white/[0.04]",
            "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden",
          )}
        >
          <div className="space-y-3 p-3">
            {input && Object.keys(input).length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-white/30">
                  Input
                </h4>
                <div className="rounded-md border border-white/[0.04] bg-white/[0.02] p-2 font-mono text-sm text-white/60">
                  {Object.entries(input).map(([key, value]) => (
                    <div key={key} className="mb-1">
                      <span className="text-white/30">{key}:</span>{" "}
                      <span>{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {output && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-white/30">
                  Output
                </h4>
                <div className="max-h-60 overflow-auto rounded-md border border-white/[0.04] bg-white/[0.02] p-2 font-mono text-sm text-white/60">
                  <pre className="whitespace-pre-wrap">
                    {formatValue(output)}
                  </pre>
                </div>
              </div>
            )}

            {state === "output-error" && toolPart.errorText && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-red-400/80">
                  Error
                </h4>
                <div className="rounded-md border border-red-500/20 bg-red-500/[0.04] p-2 text-sm text-red-400/80">
                  {toolPart.errorText}
                </div>
              </div>
            )}

            {state === "input-streaming" && (
              <div className="text-sm text-white/30 animate-pulse">
                Processing tool call...
              </div>
            )}

            {toolCallId && (
              <div className="border-t border-white/[0.04] pt-2 text-xs text-white/20">
                <span className="font-mono">Call ID: {toolCallId}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export { Tool };
