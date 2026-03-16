import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent",
        outline:
          "border border-border bg-transparent hover:bg-surface-2 hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent",
        ghost: "hover:bg-surface-2 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1.5 text-xs rounded-md has-[>svg]:px-2.5",
        xs: "h-6 gap-1 rounded-sm px-1.5 text-xs has-[>svg]:px-1 [&_svg]:size-3",
        sm: "h-7 gap-1 rounded-sm px-2 text-xs has-[>svg]:px-1.5",
        lg: "h-9 rounded-md px-4 text-sm has-[>svg]:px-3",
        icon: "size-8 rounded-md",
        "icon-xs": "size-6 rounded-sm [&_svg]:size-3",
        "icon-sm": "size-7 rounded-sm",
        "icon-lg": "size-9 rounded-md",
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
