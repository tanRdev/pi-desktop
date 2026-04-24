import { useEffect, useMemo, useRef, useState } from "react";
import { Pulse, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { globalPerfStore, type PerfStore } from "./perf-store";
import { usePerfEntries } from "./use-perf";

export interface PerfOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store?: PerfStore;
}

interface MemorySample {
  readonly usedJsHeapMb: number;
  readonly totalJsHeapMb: number;
}

interface PerformanceMemoryReading {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
}

function readPerformanceMemory(): PerformanceMemoryReading | null {
  const perfObj: unknown = (globalThis as { performance?: unknown })
    .performance;
  if (perfObj === null || typeof perfObj !== "object") return null;
  if (!("memory" in perfObj)) return null;
  const mem: unknown = (perfObj as { memory: unknown }).memory;
  if (mem === null || typeof mem !== "object") return null;
  if (!("usedJSHeapSize" in mem) || !("totalJSHeapSize" in mem)) return null;
  const used = (mem as { usedJSHeapSize: unknown }).usedJSHeapSize;
  const total = (mem as { totalJSHeapSize: unknown }).totalJSHeapSize;
  if (typeof used !== "number" || typeof total !== "number") return null;
  return { usedJSHeapSize: used, totalJSHeapSize: total };
}

/** FPS measured via `requestAnimationFrame` in 1s windows. */
function useFps(active: boolean): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (typeof requestAnimationFrame !== "function") return;

    let frames = 0;
    let last = performance.now();
    let raf = 0;
    let cancelled = false;

    const loop = (now: number): void => {
      if (cancelled) return;
      frames += 1;
      if (now - last >= 1000) {
        const dt = now - last;
        setFps(Math.round((frames * 1000) / dt));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [active]);

  return fps;
}

function useMemorySample(
  active: boolean,
  intervalMs: number = 1000,
): MemorySample | null {
  const [sample, setSample] = useState<MemorySample | null>(null);

  useEffect(() => {
    if (!active) return;
    const tick = (): void => {
      const reading = readPerformanceMemory();
      if (reading === null) {
        setSample(null);
        return;
      }
      setSample({
        usedJsHeapMb: reading.usedJSHeapSize / (1024 * 1024),
        totalJsHeapMb: reading.totalJSHeapSize / (1024 * 1024),
      });
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [active, intervalMs]);

  return sample;
}

interface AggregatedTiming {
  readonly name: string;
  readonly count: number;
  readonly avgMs: number;
  readonly maxMs: number;
  readonly lastMs: number;
}

function aggregate(
  entries: ReadonlyArray<{ name: string; ms: number }>,
): AggregatedTiming[] {
  const map = new Map<
    string,
    { total: number; max: number; count: number; last: number }
  >();
  for (const e of entries) {
    const cur = map.get(e.name);
    if (cur === undefined) {
      map.set(e.name, { total: e.ms, max: e.ms, count: 1, last: e.ms });
    } else {
      cur.total += e.ms;
      cur.count += 1;
      cur.last = e.ms;
      if (e.ms > cur.max) cur.max = e.ms;
    }
  }
  const out: AggregatedTiming[] = [];
  for (const [name, v] of map.entries()) {
    out.push({
      name,
      count: v.count,
      avgMs: v.total / v.count,
      maxMs: v.max,
      lastMs: v.last,
    });
  }
  out.sort((a, b) => b.avgMs - a.avgMs);
  return out;
}

function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${Math.round(ms)}ms`;
}

export function PerfOverlay({
  open,
  onOpenChange,
  store = globalPerfStore,
}: PerfOverlayProps): React.ReactElement | null {
  const entries = usePerfEntries(store);
  const fps = useFps(open);
  const memory = useMemorySample(open);
  const closeRef = useRef<HTMLButtonElement>(null);

  const aggregated = useMemo(() => aggregate(entries), [entries]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const fpsTone =
    fps === 0
      ? "text-white/40"
      : fps >= 55
        ? "text-emerald-400"
        : fps >= 30
          ? "text-amber-400"
          : "text-red-400";

  return (
    <div
      role="dialog"
      aria-label="Performance overlay"
      data-testid="perf-overlay"
      className={cn(
        "pointer-events-auto fixed bottom-3 right-3 z-[1000] w-[320px]",
        "bg-[var(--color-bg-secondary)]/95 border border-white/[0.08]",
        "text-[11px] text-white/80 font-mono shadow-xl backdrop-blur",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="flex items-center gap-2">
          <Pulse className="size-3.5 text-emerald-400" />
          <span className="text-white/90 tracking-wide uppercase text-[11px]">
            Perf
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close performance overlay"
          onClick={() => onOpenChange(false)}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-white/[0.06]">
        <div className="flex flex-col">
          <span className="text-white/40 text-[11px] uppercase">FPS</span>
          <span className={cn("tabular-nums", fpsTone)} data-testid="perf-fps">
            {fps}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-white/40 text-[11px] uppercase">Heap</span>
          <span className="tabular-nums text-white/80" data-testid="perf-heap">
            {memory === null ? "—" : `${memory.usedJsHeapMb.toFixed(1)}MB`}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-white/40 text-[11px] uppercase">Samples</span>
          <span
            className="tabular-nums text-white/80"
            data-testid="perf-samples"
          >
            {entries.length}
          </span>
        </div>
      </div>

      <div className="max-h-[260px] overflow-auto px-3 py-2">
        {aggregated.length === 0 ? (
          <p className="text-white/50 text-[11px] py-2">No timings recorded.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-white/40 text-[11px] uppercase">
                <th className="font-normal pb-1">name</th>
                <th className="font-normal pb-1 text-right">n</th>
                <th className="font-normal pb-1 text-right">avg</th>
                <th className="font-normal pb-1 text-right">max</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.map((row) => (
                <tr key={row.name} className="border-t border-white/[0.04]">
                  <td
                    className="py-0.5 truncate max-w-[140px]"
                    title={row.name}
                  >
                    {row.name}
                  </td>
                  <td className="py-0.5 text-right tabular-nums text-white/60">
                    {row.count}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {formatMs(row.avgMs)}
                  </td>
                  <td className="py-0.5 text-right tabular-nums text-white/60">
                    {formatMs(row.maxMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/[0.06]">
        <span className="text-white/50 text-[11px]">Mod+Alt+P to toggle</span>
        <button
          type="button"
          onClick={() => store.clear()}
          className="text-white/40 hover:text-white/80 transition-colors text-[11px]"
        >
          clear
        </button>
      </div>
    </div>
  );
}
