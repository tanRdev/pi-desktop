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
    <div className={cn("space-y-1", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-2 border border-[#474747]/30 px-2.5 py-2 transition-colors",
            item.completed
              ? "bg-[#0e0e0e] text-[#474747]"
              : "bg-[#1b1b1b] text-white",
          )}
        >
          <div className="mt-0.5 shrink-0">
            {item.completed ? (
              <CheckSquare className="size-4 text-white" />
            ) : (
              <Square className="size-4 text-[#474747]" />
            )}
          </div>
          <span
            className={cn(
              "text-[11px] leading-tight font-mono uppercase",
              item.completed && "line-through opacity-50",
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
