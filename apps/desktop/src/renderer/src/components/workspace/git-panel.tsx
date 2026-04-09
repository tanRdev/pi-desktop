import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ArrowUpRight, CaretRight, Circle } from "@/components/ui/icons";

export function GitPanel({ className, projectName }: { className?: string; projectName?: string }) {
  return (
    <div className={cn("flex h-full flex-col bg-[#0a0a0a] text-white", className)}>
      <div className="flex h-9 shrink-0 items-center border-b border-white/[0.03] px-4 select-none">
        <h2 className="text-[12px] font-medium text-white/80">Git</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="p-3">
          <div className="space-y-2">
            <textarea
              className="w-full resize-none rounded bg-transparent p-0 text-[12px] text-white/80 placeholder:text-white/30 focus:outline-none"
              placeholder={`Message (⌘+Enter on '${projectName ?? "project"}')`}
              rows={2}
            />
            <div className="flex items-center justify-between">
              <div />
              <button className="flex items-center gap-1 rounded bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/[0.1] opacity-50 cursor-not-allowed">
                <Check className="size-3" />
                Commit
              </button>
            </div>
            <p className="text-[11px] text-[#90733a] pt-1">
              Select a workspace with a root path to open files here.
            </p>
          </div>
        </div>

        <div className="border-t border-white/[0.03] p-3">
          <h3 className="mb-2 text-[12px] font-medium text-white/80">Actions</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-[11px] text-white/40">Git status</h4>
              <ul className="space-y-2">
                <li className="group flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 text-white/60">
                    <Circle className="size-3.5" />
                    <span>1 uncommitted change</span>
                  </div>
                  <button className="text-[#3b82f6] hover:text-[#60a5fa]">Commit and push</button>
                </li>
                <li className="group flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 text-white/60">
                    <Circle className="size-3.5" />
                    <span>Merge conflicts detected</span>
                  </div>
                  <button className="text-[#3b82f6] hover:text-[#60a5fa]">Resolve</button>
                </li>
                <li className="group flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 text-white/60">
                    <Circle className="size-3.5" />
                    <span>Waiting for PR review</span>
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-[11px] text-white/40">Deployments</h4>
              <ul className="space-y-2">
                <li className="group flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 text-[#22c55e]">
                    <Check className="size-3.5" />
                    <span className="text-white/80">▲</span>
                    <span className="text-white/60">marketing</span>
                  </div>
                  <ArrowUpRight className="size-3.5 text-[#3b82f6] opacity-0 transition-opacity group-hover:opacity-100" />
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-[11px] text-white/40">Checks</h4>
              <ul className="space-y-2">
                {[
                  { name: "changes", time: "12s" },
                  { name: "staging-locked", time: "6s" },
                  { name: "Deploy to Staging" },
                  { name: "Vercel Agent Review", time: "1s", isArrow: true },
                  { name: "Seer Code Review", time: "2m", isArrow: true },
                  { name: "Vercel Preview Comments", time: "0s", isArrow: true },
                  { name: "Vercel - app", isArrow: true },
                  { name: "Vercel - app-emails-preview", isArrow: true },
                  { name: "Vercel - design-system", isArrow: true },
                ].map((check) => (
                  <li key={check.name} className="group flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2 text-[#22c55e]">
                      <Check className="size-3.5" />
                      <span className="text-white/80">▲</span>
                      <span className="text-white/60">{check.name}</span>
                      {check.time && <span className="text-white/30">{check.time}</span>}
                    </div>
                    {check.isArrow && (
                      <ArrowUpRight className="size-3.5 text-[#3b82f6] opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
