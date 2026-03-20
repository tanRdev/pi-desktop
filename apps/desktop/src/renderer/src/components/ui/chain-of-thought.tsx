import { HugeiconsIcon, ArrowDown01Icon, CancelCircleIcon } from "@/components/ui/icons";
import React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ChainOfThoughtItemProps = React.ComponentProps<"div">;

export const ChainOfThoughtItem = ({
  children,
  className,
  ...props
}: ChainOfThoughtItemProps) => (
  <div
    className={cn(
      "text-muted-foreground text-sm",
      "transition-all duration-150 ease-out",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type ChainOfThoughtTriggerProps = React.ComponentProps<
  typeof CollapsibleTrigger
> & {
  leftIcon?: React.ReactNode;
  swapIconOnHover?: boolean;
};

export const ChainOfThoughtTrigger = ({
  children,
  className,
  leftIcon,
  swapIconOnHover = true,
  ...props
}: ChainOfThoughtTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      "group text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-start gap-1 text-left text-sm",
      "transition-all duration-150 ease-out",
      "hover:translate-x-0.5",
      "active:scale-95",
      className,
    )}
    {...props}
  >
    <div className="flex items-center gap-2">
      {leftIcon ? (
        <span className="relative inline-flex size-4 items-center justify-center">
          <span
            className={cn(
              "transition-all duration-150 ease-out",
              swapIconOnHover && "group-hover:opacity-0 group-hover:scale-90",
            )}
          >
            {leftIcon}
          </span>
          {swapIconOnHover && (
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={cn(
                "absolute size-4 opacity-0 transition-all duration-150 ease-out",
                "group-hover:opacity-100 group-hover:scale-100",
                "group-data-[state=open]:rotate-180",
              )}
            />
          )}
        </span>
      ) : (
        <span className="relative inline-flex size-4 items-center justify-center">
          <HugeiconsIcon icon={CancelCircleIcon} className="size-2 fill-current transition-transform duration-150 ease-out group-hover:scale-110" />
        </span>
      )}
      <span className="transition-transform duration-150 ease-out">{children}</span>
    </div>
    {!leftIcon && (
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className={cn(
          "size-4 transition-all duration-200 ease-out",
          "group-data-[state=open]:rotate-180",
          "group-hover:scale-110",
        )}
      />
    )}
  </CollapsibleTrigger>
);

export type ChainOfThoughtContentProps = React.ComponentProps<
  typeof CollapsibleContent
>;

export const ChainOfThoughtContent = ({
  children,
  className,
  ...props
}: ChainOfThoughtContentProps) => {
  return (
    <CollapsibleContent
      className={cn(
        "text-popover-foreground overflow-hidden",
        "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        "transition-all duration-200 ease-out",
        className,
      )}
      {...props}
    >
      <div className="grid grid-cols-[min-content_minmax(0,1fr)] gap-x-4">
        <div className="bg-primary/20 ml-1.75 h-full w-px group-data-[last=true]:hidden transition-colors duration-150" />
        <div className="ml-1.75 h-full w-px bg-transparent group-data-[last=false]:hidden" />
        <div className="mt-2 space-y-2">{children}</div>
      </div>
    </CollapsibleContent>
  );
};

export type ChainOfThoughtProps = {
  children: React.ReactNode;
  className?: string;
};

export function ChainOfThought({ children, className }: ChainOfThoughtProps) {
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={cn("space-y-0", className)}>
      {childrenArray.map((child, index) => (
        <React.Fragment key={index}>
          {React.isValidElement(child) &&
            React.cloneElement(
              child as React.ReactElement<ChainOfThoughtStepProps>,
              {
                isLast: index === childrenArray.length - 1,
              },
            )}
        </React.Fragment>
      ))}
    </div>
  );
}

export type ChainOfThoughtStepProps = {
  children: React.ReactNode;
  className?: string;
  isLast?: boolean;
};

export const ChainOfThoughtStep = ({
  children,
  className,
  isLast = false,
  ...props
}: ChainOfThoughtStepProps & React.ComponentProps<typeof Collapsible>) => {
  return (
    <Collapsible
      className={cn(
        "group",
        "transition-all duration-150 ease-out",
        className,
      )}
      data-last={isLast}
      {...props}
    >
      {children}
      <div className="flex justify-start group-data-[last=true]:hidden">
        <div className="bg-primary/20 ml-1.75 h-4 w-px transition-colors duration-150 group-hover:bg-primary/40" />
      </div>
    </Collapsible>
  );
};
