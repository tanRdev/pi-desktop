import type { GitDiffLine } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import { computeCharDiff } from "./compute-char-diff";

function IntraLineSpan({
  text,
  highlightStart,
  highlight,
  highlightClass,
  defaultClass,
}: {
  text: string;
  highlightStart: number;
  highlight: string;
  highlightClass: string;
  defaultClass: string;
}) {
  if (!highlight) return <span className={defaultClass}>{text}</span>;
  return (
    <>
      {highlightStart > 0 && (
        <span className={defaultClass}>{text.slice(0, highlightStart)}</span>
      )}
      <span className={highlightClass}>{highlight}</span>
      {highlightStart + highlight.length < text.length && (
        <span className={defaultClass}>
          {text.slice(highlightStart + highlight.length)}
        </span>
      )}
    </>
  );
}

export interface DiffLineProps {
  line: GitDiffLine;
  pairedLine: GitDiffLine | null;
  /** When true the row can be clicked to (de)select it for a question. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (line: GitDiffLine) => void;
}

export function DiffLine({
  line,
  pairedLine,
  selectable = false,
  selected = false,
  onToggleSelect,
}: DiffLineProps) {
  if (line.type === "hunk_header") {
    return (
      <div className="flex font-mono text-[11px] leading-[18px] text-blue-400 select-none">
        <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]" />
        <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]" />
        <span className="w-4 shrink-0 select-none text-center" />
        <span className="truncate pl-1 text-blue-400">{line.content}</span>
      </div>
    );
  }

  const isAdd = line.type === "add";
  const isRemove = line.type === "remove";
  const bgClass = isAdd ? "bg-emerald-500/10" : isRemove ? "bg-red-500/10" : "";
  const textClass = isAdd
    ? "text-emerald-400"
    : isRemove
      ? "text-red-400"
      : "text-white/50";
  const prefix = isAdd ? "+" : isRemove ? "-" : " ";
  const lineNumber = isRemove
    ? line.oldLineNumber
    : isAdd
      ? line.newLineNumber
      : line.newLineNumber;
  const emptyLineNum = isRemove ? "" : isAdd ? "" : line.oldLineNumber;

  const charDiff =
    pairedLine && (isAdd || isRemove)
      ? computeCharDiff(
          isRemove ? line.content : pairedLine.content,
          isAdd ? line.content : pairedLine.content,
        )
      : null;
  const middle = isRemove ? charDiff?.oldMiddle : charDiff?.newMiddle;
  const middleStart = charDiff ? charDiff.prefix.length : 0;

  return (
    <div
      className={cn(
        "flex font-mono text-[11px] leading-[18px]",
        bgClass,
        selectable && "cursor-pointer hover:bg-white/[0.06]",
        selected && "bg-sky-500/20 ring-1 ring-inset ring-sky-400/50",
      )}
      {...(selectable
        ? {
            role: "button" as const,
            tabIndex: 0,
            "aria-pressed": selected,
            "data-selected": selected,
            title: "Select line to ask about it",
            onClick: () => onToggleSelect?.(line),
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleSelect?.(line);
              }
            },
          }
        : {})}
    >
      <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]">
        {isRemove ? lineNumber : emptyLineNum}
      </span>
      <span className="w-9 shrink-0 select-none text-right text-white/50 pr-2 border-r border-white/[0.06]">
        {isAdd ? lineNumber : emptyLineNum}
      </span>
      <span className={cn("w-4 shrink-0 select-none text-center", textClass)}>
        {prefix}
      </span>
      <span className="truncate pl-1">
        {charDiff && middle ? (
          <IntraLineSpan
            text={line.content}
            highlightStart={middleStart}
            highlight={middle}
            highlightClass={isRemove ? "bg-red-500/25" : "bg-emerald-500/25"}
            defaultClass={textClass}
          />
        ) : (
          <span className={textClass}>{line.content}</span>
        )}
      </span>
    </div>
  );
}
