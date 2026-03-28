import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

export type MessageProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const Message = ({ children, className, ...props }: MessageProps) => (
  <div
    className={cn(
      "flex gap-2.5",
      "transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)]",
      "motion-reduce:transition-none motion-reduce:duration-0",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = {
  src: string;
  alt: string;
  fallback?: string;
  delayMs?: number;
  className?: string;
};

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar
      className={cn(
        "h-7 w-7 shrink-0 rounded-md",
        "transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "hover:scale-105",
        "active:scale-[0.97]",
        "motion-reduce:transition-none motion-reduce:duration-0",
        className,
      )}
    >
      <AvatarImage src={src} alt={alt} />
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  );
};

export type MessageContentProps = {
  children: React.ReactNode;
  markdown?: boolean;
  className?: string;
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>;

const MessageContent = ({
  children,
  markdown = false,
  className,
  ...props
}: MessageContentProps) => {
  const classNames = cn(
    "shell-console-message rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-[13px] leading-6 text-foreground prose break-words whitespace-normal",
    "transition-colors transition-border duration-[var(--duration-fast)] ease-[var(--ease-out)]",
    "hover:border-border/60",
    "motion-reduce:transition-none motion-reduce:duration-0",
    className,
  );

  return markdown ? (
    <Markdown className={classNames} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
};

export type MessageActionsProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn(
      "text-muted-foreground flex items-center gap-2",
      "opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]",
      "group-hover:opacity-100",
      "motion-reduce:transition-none motion-reduce:duration-0",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionProps = {
  className?: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className={cn(
            "transition-colors transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            "motion-reduce:transition-none motion-reduce:duration-0",
            className,
          )}
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
};
