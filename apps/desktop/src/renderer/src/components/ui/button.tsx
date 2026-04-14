import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm transition-all duration-[var(--duration-fast)] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 font-medium",
  {
    variants: {
      variant: {
        default:
          "bg-white/[0.9] text-[var(--color-bg-secondary)] hover:bg-white active:bg-white/80 border-none font-medium",
        destructive:
          "bg-red-500/80 text-white hover:bg-red-500 active:bg-red-600 border-none",
        outline:
          "border border-white/[0.08] bg-transparent text-white/70 hover:border-white/[0.15] hover:text-white active:bg-white/[0.04]",
        secondary:
          "bg-white/[0.06] text-white/80 hover:bg-white/[0.1] active:bg-white/[0.14] border-none",
        ghost:
          "text-white/40 hover:text-white/70 hover:bg-white/[0.04] active:text-white active:bg-white/[0.06]",
        link: "text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-4 py-2 text-[16px]",
        xs: "h-4 gap-1 px-1 text-[14px] [&_svg]:size-3",
        sm: "h-6 gap-1 px-2 text-[14px]",
        lg: "h-12 px-8 text-[16px]",
        icon: "size-8",
        "icon-xs": "size-5 [&_svg]:size-3",
        "icon-sm": "size-6",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
