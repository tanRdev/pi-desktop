/**
 * Note window content - renders a note document in a window.
 */

import type { NoteWindow } from "@pidesk/shared";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Textarea } from "../ui/textarea";

export interface NoteWindowContentProps {
  /** Note window data */
  window: NoteWindow;
  /** Note content */
  content?: string;
  /** Called when content changes */
  onContentChange?: (content: string) => void;
  /** Called when note is saved */
  onSave?: () => void;
  /** Additional class name */
  className?: string;
}

export function NoteWindowContent({
  window: win,
  content = "",
  onContentChange,
  onSave,
  className,
}: NoteWindowContentProps) {
  const [localContent, setLocalContent] = React.useState(content);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = React.useCallback(
    (next: string) => {
      setLocalContent(next);
      onContentChange?.(next);
    },
    [onContentChange],
  );

  // Autosave after a short idle period when content has changed
  React.useEffect(() => {
    if (!onSave) return;
    // Only autosave when local content diverges from the prop content
    if (localContent === content) return;

    const id = setTimeout(() => {
      try {
        onSave();
      } catch (err) {
        // Save errors are surfaced elsewhere; swallow here
        // to avoid affecting typing UX.
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [localContent, content, onSave]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Support Cmd/Ctrl+S to trigger explicit save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave?.();
      }
    },
    [onSave],
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <ScrollArea className="min-h-0 flex-1">
        <Textarea
          ref={textareaRef}
          value={localContent}
          onChange={(ev) => handleChange(ev.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing your note..."
          className="min-h-full w-full h-full resize-none border-0 bg-transparent p-4 font-[var(--app-font-mono)] text-sm leading-relaxed text-foreground outline-none"
        />
      </ScrollArea>
    </div>
  );
}