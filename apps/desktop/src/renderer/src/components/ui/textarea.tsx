import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-surface-1 px-3 py-2 text-sm shadow-sm",
        "transition-all duration-[150ms] ease-[var(--ease-out)]",
        "placeholder:text-muted-foreground",
        "focus-visible:border-border-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:shadow-sm focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "motion-reduce:transition-none motion-reduce:duration-0",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
