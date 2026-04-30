import type { HTMLAttributes, ReactNode, RefObject } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "../../lib/utils";

type ChatContainerContentProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

type ChatContainerScrollAnchorProps = {
  className?: string;
  ref?: RefObject<HTMLDivElement>;
} & HTMLAttributes<HTMLDivElement>;

function ChatContainerRoot({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <StickToBottom
      className={cn("flex overflow-y-auto bg-transparent", className)}
      resize="smooth"
      initial="instant"
      role="log"
      {...props}
    >
      {children}
    </StickToBottom>
  );
}

function ChatContainerContent({
  children,
  className,
  ...props
}: ChatContainerContentProps) {
  return (
    <StickToBottom.Content
      className={cn("flex w-full flex-col min-h-full", className)}
      {...props}
    >
      {children}
    </StickToBottom.Content>
  );
}

function ChatContainerScrollAnchor({
  className,
  ...props
}: ChatContainerScrollAnchorProps) {
  return (
    <div
      className={cn("h-px w-full shrink-0 scroll-mt-4", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor };
