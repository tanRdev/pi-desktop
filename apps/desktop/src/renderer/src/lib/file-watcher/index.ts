export {
  createFileWatcherBridge,
  type FileWatcherBridge,
  type FileWatcherBridgeOptions,
  isNativeWatchAvailable,
} from "./file-watcher-bridge";
export {
  type FileChangeEvent,
  type FileChangeEventType,
  type FileChangeSubscriber,
  type FileWatcherStream,
  type FileWatcherStreamOptions,
  type FsWatchFn,
  watch,
} from "./file-watcher-stream";
export {
  type UseFileWatcherResult,
  useFileWatcher,
} from "./use-file-watcher";
