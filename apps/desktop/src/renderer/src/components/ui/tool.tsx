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
              "h-4 w-4 animate-spin text-blue-500",
              "transition-all duration-150 ease-out",
            )}
          />
        );
      case "input-available":
        return (
          <Settings
            className={cn(
              "h-4 w-4 text-orange-500",
              "transition-all duration-150 ease-out",
            )}
          />
        );
      case "output-available":
        return (
          <CheckCircle
            className={cn(
              "h-4 w-4 text-zinc-400",
              "transition-all duration-150 ease-out",
            )}
          />
        );
      case "output-error":
        return (
          <XCircle
            className={cn(
              "h-4 w-4 text-red-500",
              "transition-all duration-150 ease-out",
            )}
          />
        );
      default:
        return (
          <Settings
            className={cn(
              "text-muted-foreground h-4 w-4",
              "transition-all duration-150 ease-out",
            )}
          />
        );
    }
  };

  const getStateBadge = () => {
    const baseClasses = cn(
      "px-2 py-1 rounded-md text-xs font-medium",
      "transition-all duration-150 ease-out",
    );
    switch (state) {
      case "input-streaming":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              "animate-pulse",
            )}
          >
            Processing
          </span>
        );
      case "input-available":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
            )}
          >
            Ready
          </span>
        );
      case "output-available":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
            )}
          >
            Completed
          </span>
        );
      case "output-error":
        return (
          <span
            className={cn(
              baseClasses,
              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            )}
          >
            Error
          </span>
        );
      default:
        return (
          <span
            className={cn(
              baseClasses,
              "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
            )}
          >
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
        "border-border mt-3 overflow-hidden rounded-md border",
        "transition-all duration-200 ease-out",
        "hover:border-border-hover",
        className,
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "bg-background h-auto w-full justify-between rounded-md px-3 py-2 font-normal",
              "transition-all duration-150 ease-out",
              "hover:bg-surface-2",
              "active:scale-[0.99]",
            )}
          >
            <div className="flex items-center gap-2">
              {getStateIcon()}
              <span className="font-mono text-sm font-medium">
                {toolPart.type}
              </span>
              {getStateBadge()}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200 ease-out",
                isOpen && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            "border-border border-t",
            "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden",
          )}
        >
          <div className="bg-background space-y-3 p-3">
            {input && Object.keys(input).length > 0 && (
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Input
                </h4>
                <div className="bg-background rounded-md border p-2 font-mono text-sm">
                  {Object.entries(input).map(([key, value]) => (
                    <div key={key} className="mb-1">
                      <span className="text-muted-foreground">{key}:</span>{" "}
                      <span>{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {output && (
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Output
                </h4>
                <div className="bg-background max-h-60 overflow-auto rounded-md border p-2 font-mono text-sm">
                  <pre className="whitespace-pre-wrap">
                    {formatValue(output)}
                  </pre>
                </div>
              </div>
            )}

            {state === "output-error" && toolPart.errorText && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-red-500">Error</h4>
                <div className="bg-background rounded-md border border-red-200 p-2 text-sm dark:border-red-950 dark:bg-red-900/20">
                  {toolPart.errorText}
                </div>
              </div>
            )}

            {state === "input-streaming" && (
              <div className="text-muted-foreground text-sm animate-pulse">
                Processing tool call...
              </div>
            )}

            {toolCallId && (
              <div className="text-muted-foreground border-t border-blue-200 pt-2 text-xs">
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
