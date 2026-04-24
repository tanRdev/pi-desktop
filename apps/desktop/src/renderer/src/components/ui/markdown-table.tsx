import type { ComponentPropsWithoutRef } from "react";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

type NodeExtra = { node?: unknown };

export function MarkdownTable({
  children,
  ...props
}: ComponentPropsWithoutRef<"table"> & NodeExtra) {
  return (
    <div className="my-6 overflow-x-auto">
      <table
        className="w-full border-collapse text-sm border border-white/[0.06]"
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function MarkdownThead({
  children,
  ...props
}: ComponentPropsWithoutRef<"thead"> & NodeExtra) {
  return (
    <thead
      className="sticky top-0 z-10 border-b border-white/[0.06] bg-white/[0.02]"
      {...props}
    >
      {children}
    </thead>
  );
}

export function MarkdownTbody({
  children,
  ...props
}: ComponentPropsWithoutRef<"tbody"> & NodeExtra) {
  return (
    <tbody className="divide-y divide-white/[0.04]" {...props}>
      {children}
    </tbody>
  );
}

export function MarkdownTr({
  children,
  ...props
}: ComponentPropsWithoutRef<"tr"> & NodeExtra) {
  return (
    <tr
      className={cn(
        "even:bg-white/[0.02] transition-all duration-150 ease-out hover:bg-white/[0.06]",
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function MarkdownTh({
  children,
  ...props
}: ComponentPropsWithoutRef<"th"> & NodeExtra) {
  return (
    <th
      className="px-3 py-2 text-left text-xs font-normal uppercase tracking-wide text-white/40"
      {...props}
    >
      {children}
    </th>
  );
}

export function MarkdownTd({
  children,
  ...props
}: ComponentPropsWithoutRef<"td"> & NodeExtra) {
  return (
    <td
      className="px-3 py-2 text-sm text-white/60 border-white/[0.06]"
      {...props}
    >
      {children}
    </td>
  );
}

export const markdownTableComponents: Partial<Components> = {
  table: MarkdownTable,
  thead: MarkdownThead,
  tbody: MarkdownTbody,
  tr: MarkdownTr,
  th: MarkdownTh,
  td: MarkdownTd,
};
