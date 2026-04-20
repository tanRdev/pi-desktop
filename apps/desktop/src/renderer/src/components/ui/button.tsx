import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 font-normal will-change-transform active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default:
          "bg-white/[0.75] text-[var(--color-bg-secondary)] hover:bg-white/[0.85] active:bg-white/60 border-none font-normal",
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
        default: "h-8 px-4 py-2 text-[10.5px]",
        xs: "h-4 gap-1 px-1 text-[10.5px] [&_svg]:size-3",
        sm: "h-6 gap-1 px-2 text-[10.5px]",
        lg: "h-12 px-8 text-[10.5px]",
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

  if (process.env.NODE_ENV !== "production") {
    const isIconSize =
      size === "icon" ||
      size === "icon-xs" ||
      size === "icon-sm" ||
      size === "icon-lg";
    if (isIconSize) {
      const hasAria =
        typeof props["aria-label"] === "string" &&
        props["aria-label"].trim().length > 0;
      const hasAriaLabelledBy =
        typeof props["aria-labelledby"] === "string" &&
        props["aria-labelledby"].trim().length > 0;
      const hasTitle =
        typeof props.title === "string" && props.title.trim().length > 0;
      const hasTextChild = hasTextNode(props.children);
      if (!hasAria && !hasAriaLabelledBy && !hasTitle && !hasTextChild) {
        // eslint-disable-next-line no-console
        console.warn(
          "[Button] Icon-only button is missing an accessible name. " +
            "Provide `aria-label`, `aria-labelledby`, `title`, or text children.",
        );
      }
    }
  }

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

function hasTextNode(children: React.ReactNode): boolean {
  if (children == null || children === false) return false;
  if (typeof children === "string") return children.trim().length > 0;
  if (typeof children === "number") return true;
  if (Array.isArray(children)) {
    return children.some((c) => hasTextNode(c));
  }
  return false;
}

export { Button, buttonVariants };
