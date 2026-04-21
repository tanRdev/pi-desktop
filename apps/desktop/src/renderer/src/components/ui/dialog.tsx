"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { ICON_SIZE_MD, X } from "@/components/ui/icons";
import { trapFocus } from "@/lib/a11y/focus-trap";
import { useFocusRestoration } from "@/lib/a11y/use-focus-restoration";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-pi-dialog-overlay="true"
    aria-hidden="true"
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      "motion-reduce:animate-none",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, forwardedRef) => {
  const contentRef = React.useRef<HTMLDivElement>(null!);

  React.useImperativeHandle(forwardedRef, () => contentRef.current);

  useFocusRestoration(true);

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const release = trapFocus(el);
    return release;
  }, []);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        data-pi-dialog-content="true"
        className={cn(
          "fixed z-50 grid w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto gap-0 border border-white/[0.06] bg-[var(--color-bg-tertiary)] p-0 shadow-[0_16px_48px_rgba(0,0,0,0.5)] outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
          className,
        )}
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className={cn(
            "absolute right-0 top-0 p-3 text-white/30 transition-all duration-150",
            "hover:text-white/60 hover:bg-white/[0.04]",
            "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none",
            "data-[state=open]:bg-white/[0.04]",
          )}
        >
          <X className={ICON_SIZE_MD} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1 px-6 py-4",
      "bg-[var(--color-bg-secondary)]",
      "border-b border-white/[0.06]",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4",
      "bg-[var(--color-bg-secondary)]",
      "border-t border-white/[0.06]",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-sm font-normal text-white/90", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-white/40", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
