"use client";

import { CheckSquare, Square } from "@phosphor-icons/react";
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
    <div className={cn("space-y-1", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-2 border border-white/[0.08] px-2.5 py-2 transition-colors",
            item.completed
              ? "bg-transparent text-white/30"
              : "bg-white/[0.02] text-white/70",
          )}
        >
          <div className="mt-0.5 shrink-0">
            {item.completed ? (
              <CheckSquare className="size-4 text-white/[0.1]" />
            ) : (
              <Square className="size-4 text-white/[0.08]" />
            )}
          </div>
          <span
            className={cn(
              "text-[11px] leading-tight font-mono uppercase",
              item.completed && "line-through text-white/30",
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
