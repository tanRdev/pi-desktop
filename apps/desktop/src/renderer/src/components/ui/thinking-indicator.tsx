"use client";

import { Brain, CaretDown } from "@phosphor-icons/react";
import type * as React from "react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ============================================
// StreamingPlaceholder — compact pre-stream dots
// ============================================

export interface StreamingPlaceholderProps {
  className?: string;
}

export function StreamingPlaceholder({ className }: StreamingPlaceholderProps) {
  return (
    <output
      className={cn("flex items-center gap-1 py-2", className)}
      aria-live="polite"
      aria-label="Generating response"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 bg-white/30"
          style={{
            animation: `shimmer-bounce 1.4s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </output>
  );
}

// ============================================
// ThinkingBlock — expandable reasoning output
// ============================================

export interface ThinkingBlockProps
  extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
  status?: "thinking" | "complete";
  duration?: string;
  defaultOpen?: boolean;
}

export function ThinkingBlock({
  content,
  status = "thinking",
  duration,
  defaultOpen = false,
  className,
  ...props
}: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isThinking = status === "thinking";

  return (
    <div
      className={cn(
        "overflow-hidden border",
        "border-cyan-500/10 bg-cyan-500/[0.02]",
        className,
      )}
      {...props}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-3 px-3 py-2",
              "text-left transition-colors duration-[var(--duration-fast)]",
              "hover:bg-cyan-500/[0.03]",
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center",
                  "bg-cyan-400/10",
                )}
              >
                <Brain
                  className={cn(
                    "size-3.5 text-cyan-400/70",
                    isThinking && "animate-pulse",
                  )}
                  weight="fill"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-normal text-cyan-400/80">
                  {isThinking ? "Thinking" : "Thought process"}
                </span>

                {isThinking && (
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-1 bg-cyan-400/40"
                        style={{
                          animation: `shimmer-bounce 1.4s ease-in-out ${i * 0.15}s infinite`,
                        }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {duration && !isThinking && (
                <span className="text-[11px] tabular-nums text-cyan-400/40">
                  {duration}
                </span>
              )}
              <CaretDown
                className={cn(
                  "size-3.5 text-cyan-400/40 transition-transform duration-[var(--duration-normal)]",
                  isOpen && "rotate-180",
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent
          className={cn(
            "border-t border-cyan-500/[0.06]",
            "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden",
          )}
        >
          <div className="p-3">
            <div
              className={cn(
                "max-h-80 overflow-auto border border-cyan-500/[0.06]",
                "bg-cyan-500/[0.02] p-3",
              )}
            >
              <pre
                className={cn(
                  "whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed",
                  "text-cyan-100/50",
                )}
              >
                {content}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================
// ReasoningChain — sequential step list
// ============================================

export interface ReasoningChainProps
  extends React.HTMLAttributes<HTMLDivElement> {
  steps: Array<{
    id: string;
    label: string;
    status: "pending" | "running" | "complete" | "error";
    duration?: string;
  }>;
}

export function ReasoningChain({
  steps,
  className,
  ...props
}: ReasoningChainProps) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("space-y-1", className)} {...props}>
      {steps.map((step, index) => (
        <ReasoningStep
          key={step.id}
          step={step}
          isLast={index === steps.length - 1}
        />
      ))}
    </div>
  );
}

interface ReasoningStepProps {
  step: {
    id: string;
    label: string;
    status: "pending" | "running" | "complete" | "error";
    duration?: string;
  };
  isLast: boolean;
}

function ReasoningStep({ step, isLast }: ReasoningStepProps) {
  const statusColors = {
    pending: "bg-white/[0.06]",
    running: "bg-cyan-400/50",
    complete: "bg-cyan-400/30",
    error: "bg-red-400/50",
  };

  const statusIcon = {
    pending: null,
    running: <div className="size-1.5 bg-cyan-400/60 animate-pulse" />,
    complete: <div className="size-1.5 bg-cyan-400/40" />,
    error: <div className="size-1.5 bg-red-400/60" />,
  };

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-4 w-4 items-center justify-center border",
            "border-cyan-400/20",
            step.status === "running" ? "bg-cyan-400/10" : "bg-cyan-400/[0.04]",
          )}
        >
          {statusIcon[step.status]}
        </div>

        {!isLast && (
          <div
            className={cn(
              "mt-1 h-full w-px min-h-[16px]",
              statusColors[step.status],
            )}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 pb-3">
        <span
          className={cn(
            "text-[11px]",
            step.status === "running" ? "text-cyan-100/70" : "text-cyan-100/40",
          )}
        >
          {step.label}
        </span>

        {step.duration && step.status === "complete" && (
          <span className="text-[11px] tabular-nums text-cyan-400/30">
            {step.duration}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// ThinkingIndicator — unified entry point
// ============================================

export type ThinkingIndicatorMode = "placeholder" | "block" | "chain";

export interface ThinkingIndicatorProps {
  /** Which variant to render. */
  mode: ThinkingIndicatorMode;
  /** Required when mode === "block" */
  content?: string;
  /** Required when mode === "block" */
  status?: "thinking" | "complete";
  duration?: string;
  defaultOpen?: boolean;
  /** Required when mode === "chain" */
  steps?: ReasoningChainProps["steps"];
  className?: string;
}

/**
 * Canonical chat thinking/streaming indicator. Replaces the former trio of
 * ThinkingBar, ThinkingBlock, and StreamingPlaceholder. Callers choose a
 * mode instead of importing three separate components.
 */
export function ThinkingIndicator({
  mode,
  content = "",
  status = "thinking",
  duration,
  defaultOpen,
  steps,
  className,
}: ThinkingIndicatorProps) {
  if (mode === "placeholder") {
    return <StreamingPlaceholder className={className} />;
  }

  if (mode === "chain") {
    return <ReasoningChain steps={steps ?? []} className={className} />;
  }

  return (
    <ThinkingBlock
      content={content}
      status={status}
      duration={duration}
      defaultOpen={defaultOpen}
      className={className}
    />
  );
}
