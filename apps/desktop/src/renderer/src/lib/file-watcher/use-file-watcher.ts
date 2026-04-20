import { useCallback, useEffect, useRef, useState } from "react";
import {
  type FileChangeEvent,
  type FileWatcherStream,
  watch,
} from "./file-watcher-stream";

const RING_BUFFER_SIZE = 50;

export interface UseFileWatcherResult {
  events: ReadonlyArray<FileChangeEvent>;
  lastEvent: FileChangeEvent | null;
  isWatching: boolean;
}

export function useFileWatcher(
  workspacePath?: string | null,
): UseFileWatcherResult {
  const [events, setEvents] = useState<ReadonlyArray<FileChangeEvent>>([]);
  const [lastEvent, setLastEvent] = useState<FileChangeEvent | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  const ringRef = useRef<FileChangeEvent[]>([]);
  const streamRef = useRef<FileWatcherStream | null>(null);

  const appendEvent = useCallback((event: FileChangeEvent) => {
    ringRef.current.push(event);
    if (ringRef.current.length > RING_BUFFER_SIZE) {
      ringRef.current = ringRef.current.slice(-RING_BUFFER_SIZE);
    }
    setEvents(ringRef.current.slice());
    setLastEvent(event);
  }, []);

  useEffect(() => {
    if (!workspacePath) {
      streamRef.current = null;
      setIsWatching(false);
      ringRef.current = [];
      setEvents([]);
      setLastEvent(null);
      return;
    }

    ringRef.current = [];
    setEvents([]);
    setLastEvent(null);

    const stream = watch(workspacePath);
    streamRef.current = stream;
    setIsWatching(stream.isActive());

    const unsubscribe = stream.subscribe(appendEvent);

    return () => {
      unsubscribe();
      streamRef.current = null;
      setIsWatching(false);
    };
  }, [workspacePath, appendEvent]);

  return {
    events,
    lastEvent,
    isWatching,
  };
}
