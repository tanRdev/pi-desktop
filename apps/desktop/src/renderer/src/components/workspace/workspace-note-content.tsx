import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeEditor } from "../ui/code-editor";
import { Markdown } from "../ui/markdown";
import { ScrollArea } from "../ui/scroll-area";

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
  const [isEditorFocused, setIsEditorFocused] = React.useState(true);

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
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave?.();
      }
    },
    [onSave],
  );

  const handleEditorMount = React.useCallback<
    NonNullable<React.ComponentProps<typeof CodeEditor>["onMount"]>
  >((editor) => {
    editor.onDidFocusEditorWidget(() => {
      setIsEditorFocused(true);
    });

    editor.onDidBlurEditorText(() => {
      window.setTimeout(() => {
        if (!editor.hasTextFocus()) {
          setIsEditorFocused(false);
        }
      }, 0);
    });
  }, []);

  return (
    <div className={cn("flex h-full flex-col bg-[#0d0d0d]", className)}>
      <div className="min-h-0 flex-1 overflow-hidden" onKeyDown={handleKeyDown}>
        {isEditorFocused ? (
          <CodeEditor
            filePath="project-notes.md"
            value={draft}
            language="markdown"
            onChange={handleChange}
            onMount={handleEditorMount}
            className="h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditorFocused(true)}
            className="flex h-full w-full flex-col text-left"
            aria-label="Edit project notes"
          >
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-5 py-4">
                {draft.trim() ? (
                  <Markdown>{draft}</Markdown>
                ) : (
                  <p className="text-[13px] leading-7 text-[#555]">
                    Capture decisions, snippets, and reminders...
                  </p>
                )}
              </div>
            </ScrollArea>
          </button>
        )}
      </div>
    </div>
  );
}
