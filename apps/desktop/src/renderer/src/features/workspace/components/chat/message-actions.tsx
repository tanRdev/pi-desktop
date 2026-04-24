import * as React from "react";
import {
  ArrowClockwise,
  Check,
  Copy,
  PencilSimple,
  X,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type BaseBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

function ActionButton({ className, children, ...props }: BaseBtnProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-6 items-center gap-1 border border-white/[0.06] bg-white/[0.01] px-2",
        "font-mono text-[11px] uppercase tracking-wider text-white/50",
        "transition-colors duration-[var(--duration-fast)]",
        "hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/80",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-ring)]",
        "disabled:opacity-40 disabled:hover:border-white/[0.06] disabled:hover:bg-white/[0.01] disabled:hover:text-white/50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface MessageActionsProps {
  text: string;
  /** Show retry (only meaningful for failed user messages). */
  canRetry?: boolean;
  onRetry?: () => void;
  /** Show edit (only meaningful for user messages with a resubmit path). */
  canEdit?: boolean;
  onStartEdit?: () => void;
  /** Alignment. */
  align?: "start" | "end";
  className?: string;
}

/**
 * Hover-visible action cluster shown under a message bubble.
 * Copy is always present; retry/edit are conditional.
 */
export function MessageActions({
  text,
  canRetry,
  onRetry,
  canEdit,
  onStartEdit,
  align = "start",
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      // Clipboard may be unavailable in some contexts; silently fail.
    }
  }, [text]);

  return (
    <div
      data-testid="message-actions"
      className={cn(
        "flex items-center gap-1.5",
        "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        "transition-opacity duration-[var(--duration-fast)]",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      <ActionButton
        onClick={handleCopy}
        data-testid="message-copy"
        aria-label="Copy message"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </ActionButton>

      {canEdit && onStartEdit ? (
        <ActionButton
          onClick={onStartEdit}
          data-testid="message-edit"
          aria-label="Edit message"
        >
          <PencilSimple className="size-3" />
          <span>Edit</span>
        </ActionButton>
      ) : null}

      {canRetry && onRetry ? (
        <ActionButton
          onClick={onRetry}
          data-testid="message-retry"
          aria-label="Retry failed message"
        >
          <ArrowClockwise className="size-3" />
          <span>Retry</span>
        </ActionButton>
      ) : null}
    </div>
  );
}

export interface InlineMessageEditorProps {
  initialText: string;
  onCancel: () => void;
  onSubmit: (next: string) => void;
  className?: string;
}

/**
 * Inline editor for a user message. Submits with Cmd/Ctrl+Enter, cancels
 * on Escape. Stays DOM-local so it plays nicely with virtualization.
 */
export function InlineMessageEditor({
  initialText,
  onCancel,
  onSubmit,
  className,
}: InlineMessageEditorProps) {
  const [value, setValue] = React.useState(initialText);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const handleSubmit = React.useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }, [onSubmit, value]);

  const handleKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, onCancel],
  );

  return (
    <div
      data-testid="message-inline-editor"
      className={cn(
        "w-full border border-white/[0.08] bg-white/[0.02] p-2",
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        rows={Math.min(8, Math.max(2, value.split("\n").length))}
        className={cn(
          "w-full resize-none bg-transparent text-sm leading-6 text-white/80",
          "placeholder:text-white/50 focus:outline-none",
        )}
      />
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <ActionButton onClick={onCancel} data-testid="message-edit-cancel">
          <X className="size-3" />
          <span>Cancel</span>
        </ActionButton>
        <ActionButton
          onClick={handleSubmit}
          data-testid="message-edit-submit"
          disabled={value.trim().length === 0}
        >
          <Check className="size-3" />
          <span>Resubmit</span>
        </ActionButton>
      </div>
    </div>
  );
}
