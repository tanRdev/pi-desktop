"use client";

import { CheckSquare, Square } from "lucide-react";
import { cn } from "../../lib/utils";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoProps {
  items: TodoItem[];
  className?: string;
}

export function Todo({ items, className }: TodoProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-2 rounded-md border border-border-subtle px-2.5 py-2 transition-colors",
            item.completed
              ? "bg-surface-1 text-muted-foreground/70"
              : "bg-surface-2 text-foreground",
          )}
        >
          <div className="mt-0.5 shrink-0">
            {item.completed ? (
              <CheckSquare className="size-4 text-success" />
            ) : (
              <Square className="size-4 text-muted-foreground" />
            )}
          </div>
          <span
            className={cn(
              "text-sm leading-relaxed",
              item.completed && "line-through",
            )}
          >
            {item.text}
          </span>
        </div>
      ))}
    </div>
  );
}

export type { TodoItem };
