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
        "flex field-sizing-content min-h-16 w-full border-b border-[#474747] bg-[var(--color-bg-tertiary)] px-3 py-2 text-[10.5px] font-mono",
        "transition-all duration-[100ms] ease-[var(--ease-out)]",
        "placeholder:text-[#474747]/50",
        "focus-visible:border-white focus-visible:bg-white/10 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
