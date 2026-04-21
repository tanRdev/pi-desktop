import { useCallback, useMemo, useRef, useState } from "react";
import { globalPerfStore, type PerfEntry } from "@/lib/perf";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

export interface MemoryReading {
  readonly usedJsHeapMb: number;
  readonly totalJsHeapMb: number;
  readonly jsHeapSizeLimitMb: number;
}

export interface SessionHealthSnapshot {
  readonly memory: MemoryReading | null;
  readonly durationMs: number;
  readonly eventCount: number;
  readonly errorCount: number;
  readonly errorRate: number;
  readonly connectionStatus: ConnectionStatus;
}

export interface UseSessionHealthOptions {
  readonly startTime?: number;
  readonly connectionStatus?: ConnectionStatus;
}

interface PerformanceMemoryObj {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

function isPerformanceMemoryObj(obj: unknown): obj is PerformanceMemoryObj {
  if (!isRecord(obj)) return false;
  return (
    typeof obj.usedJSHeapSize === "number" &&
    typeof obj.totalJSHeapSize === "number" &&
    typeof obj.jsHeapSizeLimit === "number"
  );
}

function readPerformanceMemory(): PerformanceMemoryObj | null {
  if (!isRecord(globalThis)) return null;
  const perf = globalThis.performance;
  if (!isRecord(perf)) return null;
  const mem = perf.memory;
  if (!isPerformanceMemoryObj(mem)) return null;
  return mem;
}

function computeMemory(): MemoryReading | null {
  const raw = readPerformanceMemory();
  if (raw === null) return null;
  return {
    usedJsHeapMb: raw.usedJSHeapSize / (1024 * 1024),
    totalJsHeapMb: raw.totalJSHeapSize / (1024 * 1024),
    jsHeapSizeLimitMb: raw.jsHeapSizeLimit / (1024 * 1024),
  };
}

function pushPerfEntry(isError: boolean): void {
  const entry: PerfEntry = {
    name: isError ? "session-event-error" : "session-event",
    ms: 0,
    ts: Date.now(),
  };
  globalPerfStore.push(entry);
}

export function useSessionHealth(options: UseSessionHealthOptions = {}): {
  readonly snapshot: SessionHealthSnapshot;
  readonly incrementEventCount: (isError?: boolean) => void;
} {
  const { startTime, connectionStatus = "connected" } = options;
  const startRef = useRef<number>(startTime ?? Date.now());
  const [eventCount, setEventCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const incrementEventCount = useCallback((isError = false) => {
    setEventCount((prev) => prev + 1);
    if (isError) {
      setErrorCount((prev) => prev + 1);
    }
    pushPerfEntry(isError);
  }, []);

  const snapshot = useMemo<SessionHealthSnapshot>(() => {
    const durationMs = Date.now() - startRef.current;
    const rate = eventCount > 0 ? errorCount / eventCount : 0;
    return {
      memory: computeMemory(),
      durationMs,
      eventCount,
      errorCount,
      errorRate: rate,
      connectionStatus,
    };
  }, [eventCount, errorCount, connectionStatus]);

  return { snapshot, incrementEventCount };
}
