import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all duration-[100ms] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 font-medium",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-[#d4d4d4] active:bg-[#b0b0b0] border-none font-bold",
        destructive:
          "bg-[#93000a] text-white hover:bg-[#ffdad6] active:bg-white border-none",
        outline:
          "border border-[#474747] bg-transparent text-white hover:border-white hover:text-white active:bg-white/10",
        secondary:
          "bg-[#353535] text-white hover:bg-[#474747] active:bg-[#5a5a5a] border-none",
        ghost:
          "text-[#474747] hover:text-white active:text-white active:bg-white/10",
        link: "text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-7 px-4 py-1.5 text-[10px]",
        xs: "h-5 gap-1 px-1.5 text-[8px] [&_svg]:size-3",
        sm: "h-6 gap-1 px-2 text-[9px]",
        lg: "h-9 px-6 text-[11px]",
        icon: "size-7",
        "icon-xs": "size-5 [&_svg]:size-3",
        "icon-sm": "size-6",
        "icon-lg": "size-9",
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
