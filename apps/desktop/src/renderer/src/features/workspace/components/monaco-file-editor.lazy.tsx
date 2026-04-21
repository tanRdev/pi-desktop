import * as React from "react";
import type { MonacoFileEditorProps } from "./monaco-file-editor";

// Lazy-load the Monaco editor (heavy dependency with workers) so it only enters
// the bundle when a file is actually opened.
const LazyMonacoFileEditor = React.lazy(() =>
  import("./monaco-file-editor").then((m) => ({ default: m.MonacoFileEditor })),
);

function MonacoEditorFallback() {
  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-primary)] p-5">
      <div className="space-y-2">
        <div className="h-3 w-full bg-white/5" />
        <div className="h-3 w-5/6 bg-white/5" />
        <div className="h-3 w-4/5 bg-white/5" />
        <div className="h-3 w-full bg-white/5" />
        <div className="h-3 w-3/4 bg-white/5" />
      </div>
    </div>
  );
}

export function MonacoFileEditor(props: MonacoFileEditorProps) {
  return (
    <React.Suspense fallback={<MonacoEditorFallback />}>
      <LazyMonacoFileEditor {...props} />
    </React.Suspense>
  );
}
