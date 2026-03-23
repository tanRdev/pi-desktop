import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Textarea } from "../ui/textarea";

export interface WorkspaceNoteContentProps {
  content?: string;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  className?: string;
}

export function WorkspaceNoteContent({
  content = "",
  onContentChange,
  onSave,
  className,
}: WorkspaceNoteContentProps) {
  const [draft, setDraft] = React.useState(content);

  React.useEffect(() => {
    setDraft(content);
  }, [content]);

  React.useEffect(() => {
    if (!onSave || draft === content) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onSave();
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [content, draft, onSave]);

  const handleChange = React.useCallback(
    (nextValue: string) => {
      setDraft(nextValue);
      onContentChange?.(nextValue);
    },
    [onContentChange],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave?.();
      }
    },
    [onSave],
  );

  return (
    <div className={cn("flex h-full flex-col bg-[#0d0d0d]", className)}>
      <div className="border-b border-[#474747]/18 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#666]">
        Project notes
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Textarea
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Capture decisions, snippets, and reminders..."
          className="min-h-full w-full resize-none border-0 bg-transparent px-5 py-4 text-[13px] leading-7 text-white outline-none placeholder:text-[#555]"
        />
      </ScrollArea>
    </div>
  );
}
