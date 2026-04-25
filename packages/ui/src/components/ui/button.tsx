import * as React from "react";
import { cn } from "../../lib/utils";

const buttonBaseClassName =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)] outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 font-normal will-change-transform active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-none";

const buttonVariantClassNames = {
  default:
    "bg-white/[0.75] text-[var(--color-bg-secondary)] hover:bg-white/[0.85] active:bg-white/60 border-none font-normal",
  destructive:
    "bg-red-500/80 text-white hover:bg-red-500 active:bg-red-600 border-none",
  outline:
    "border border-white/[0.08] bg-transparent text-white/70 hover:border-white/[0.15] hover:text-white active:bg-white/[0.06]",
  secondary:
    "bg-white/[0.06] text-white/80 hover:bg-white/[0.1] active:bg-white/[0.14] border-none",
  ghost:
    "text-white/40 hover:text-white/70 hover:bg-white/[0.06] active:text-white active:bg-white/[0.06]",
  link: "text-white underline-offset-4 hover:underline",
} as const;

const buttonSizeClassNames = {
  default: "h-8 px-4 py-2 text-[11px]",
  xs: "h-4 gap-1 px-1 text-[11px] [&_svg]:size-3",
  sm: "h-6 gap-1 px-2 text-[11px]",
  lg: "h-12 px-8 text-[11px]",
  icon: "size-8",
  "icon-xs": "size-5 [&_svg]:size-3",
  "icon-sm": "size-6",
  "icon-lg": "size-10",
} as const;

type ButtonVariant = keyof typeof buttonVariantClassNames;
type ButtonSize = keyof typeof buttonSizeClassNames;

type ButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  className?: string;
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
}) {
  return cn(
    buttonBaseClassName,
    buttonVariantClassNames[variant ?? "default"],
    buttonSizeClassNames[size ?? "default"],
    className,
  );
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  if (asChild) {
    const child = React.Children.only(children);

    if (
      React.isValidElement<Record<string, unknown> & { className?: string }>(
        child,
      )
    ) {
      return React.cloneElement(child, {
        ...props,
        className: buttonVariants({
          variant,
          size,
          className: cn(className, child.props.className),
        }),
        "data-slot": "button",
        "data-variant": variant,
        "data-size": size,
      });
    }

    return child;
  }

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
      const hasTextChild = hasTextNode(children);

      if (!hasAria && !hasAriaLabelledBy && !hasTitle && !hasTextChild) {
        console.warn(
          "[Button] Icon-only button is missing an accessible name. " +
            "Provide `aria-label`, `aria-labelledby`, `title`, or text children.",
        );
      }
    }
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </button>
  );
}

function hasTextNode(children: React.ReactNode): boolean {
  if (children == null || children === false) return false;
  if (typeof children === "string") return children.trim().length > 0;
  if (typeof children === "number") return true;
  if (Array.isArray(children)) {
    return children.some((child) => hasTextNode(child));
  }

  return false;
}

export { Button, buttonVariants };
