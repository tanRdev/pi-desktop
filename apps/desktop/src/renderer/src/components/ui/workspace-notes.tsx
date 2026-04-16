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
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] bg-[var(--color-bg-secondary)] px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={cn(
              "px-2 py-0.5 text-[10.5px] font-mono font-bold uppercase tracking-wider transition-all duration-150 ease-out",
              isEditing
                ? "bg-white/[0.06] text-white/80"
                : "text-white/40 hover:bg-white/[0.04] hover:text-white/80",
            )}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className={cn(
              "px-2 py-0.5 text-[10.5px] font-mono font-bold uppercase tracking-wider transition-all duration-150 ease-out",
              !isEditing
                ? "bg-white/[0.06] text-white/80"
                : "text-white/40 hover:bg-white/[0.04] hover:text-white/80",
            )}
          >
            Preview
          </button>
        </div>
        <span className="text-[9px] font-mono text-white/30 uppercase tracking-tight">
          Markdown
        </span>
      </div>

      {/* Content Area */}
      <ScrollArea className="min-h-0 flex-1 bg-[var(--color-bg-primary)]">
        <div className="p-4">
          {isEditing ? (
            <textarea
              value={content}
              onChange={handleChange}
              placeholder={placeholder}
              className="h-full w-full resize-none border-0 bg-transparent p-0 text-[10.5px] font-mono leading-relaxed text-white/80 placeholder:text-white/20 focus:outline-none focus-visible:ring-0"
            />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none font-mono">
              {content ? (
                <Markdown>{content}</Markdown>
              ) : (
                <p className="text-white/40 uppercase text-[10.5px]">
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
