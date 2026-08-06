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
  /** The underlying stream, so consumers (e.g. the file tree) can subscribe. */
  stream: FileWatcherStream | null;
}

export function useFileWatcher(
  workspacePath?: string | null,
): UseFileWatcherResult {
  const [events, setEvents] = useState<ReadonlyArray<FileChangeEvent>>([]);
  const [lastEvent, setLastEvent] = useState<FileChangeEvent | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [stream, setStream] = useState<FileWatcherStream | null>(null);

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
      setStream(null);
      setIsWatching(false);
      ringRef.current = [];
      setEvents([]);
      setLastEvent(null);
      return;
    }

    ringRef.current = [];
    setEvents([]);
    setLastEvent(null);

    const nextStream = watch(workspacePath);
    streamRef.current = nextStream;
    setStream(nextStream);
    setIsWatching(nextStream.isActive());

    const unsubscribe = nextStream.subscribe(appendEvent);

    return () => {
      unsubscribe();
      streamRef.current = null;
      setStream(null);
      setIsWatching(false);
    };
  }, [workspacePath, appendEvent]);

  return {
    events,
    lastEvent,
    isWatching,
    stream,
  };
}
