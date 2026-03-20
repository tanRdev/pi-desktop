"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { ScrollArea } from "./scroll-area";

interface WorkspaceNotesProps {
  className?: string;
  content?: string;
  onChange?: (content: string) => void;
}

export function WorkspaceNotes({
  className,
  content = "",
  onChange,
}: WorkspaceNotesProps) {
  const [isEditing, setIsEditing] = React.useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  const placeholder = `# Workspace Notes

Write your notes here...

- Use **Markdown** formatting
- Create checklists with - [ ]
- Add \`code blocks\``;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-1 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-all duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
              isEditing
                ? "bg-surface-3 text-foreground"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground hover:-translate-y-px",
            )}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-all duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
              !isEditing
                ? "bg-surface-3 text-foreground"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground hover:-translate-y-px",
            )}
          >
            Preview
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Supports Markdown
        </span>
      </div>

      {/* Content Area */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4 motion-safe:animate-[fade-in_0.2s_var(--ease-out)]">
          {isEditing ? (
            <textarea
              value={content}
              onChange={handleChange}
              placeholder={placeholder}
              className="h-full w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0"
            />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              {content ? (
                <Markdown>{content}</Markdown>
              ) : (
                <p className="text-muted-foreground">
                  No notes yet. Switch to Edit mode to add content.
                </p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default WorkspaceNotes;
