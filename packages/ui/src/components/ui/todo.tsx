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
    <div className={cn("space-y-2", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-white/6 px-3 py-2.5 transition-colors",
            item.completed
              ? "bg-white/[0.02] text-zinc-500"
              : "bg-white/[0.04] text-zinc-200",
          )}
        >
          <div className="mt-0.5 shrink-0">
            {item.completed ? (
              <CheckSquare className="size-4 text-emerald-400" />
            ) : (
              <Square className="size-4 text-zinc-500" />
            )}
          </div>
          <span
            className={cn(
              "text-sm leading-5",
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
