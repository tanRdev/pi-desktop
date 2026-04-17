import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker.js?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker.js?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker.js?worker";
import * as React from "react";

let monacoInitialized = false;

function initializeMonacoOnce() {
  if (monacoInitialized) {
    return;
  }
  monacoInitialized = true;

  loader.config({ monaco });

  Object.defineProperty(globalThis, "MonacoEnvironment", {
    configurable: true,
    value: {
      getWorker(_: string, label: string) {
        if (label === "json") {
          return new jsonWorker();
        }

        if (label === "typescript" || label === "javascript") {
          return new tsWorker();
        }

        if (label === "html" || label === "handlebars" || label === "razor") {
          return new htmlWorker();
        }

        return new editorWorker();
      },
    },
  });

  monaco.editor.defineTheme("pi-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0b0d10",
      "editorLineNumber.foreground": "#46505c",
      "editorLineNumber.activeForeground": "#c7d0da",
      "editorCursor.foreground": "#f5f7fa",
      "editor.selectionBackground": "#ffffff14",
      "editor.inactiveSelectionBackground": "#ffffff0d",
      "editor.lineHighlightBackground": "#ffffff08",
      "editorIndentGuide.background1": "#ffffff12",
      "editorIndentGuide.activeBackground1": "#ffffff26",
    },
  });
}

export interface MonacoFileEditorProps {
  path: string;
  language: string;
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export function MonacoFileEditor({
  path,
  language,
  value,
  readOnly = false,
  onChange,
  onSave,
}: MonacoFileEditorProps) {
  // Idempotent; only performs work on the first MonacoFileEditor mount in the
  // renderer session. Running here (not at module scope) keeps the Monaco
  // runtime, worker registration, and theme definition out of the critical
  // path for routes that never open the editor.
  React.useMemo(() => initializeMonacoOnce(), []);

  return (
    <div className="h-full" data-testid="monaco-file-editor-shell">
      <Editor
        path={path}
        language={language}
        theme="pi-dark"
        value={value}
        onChange={(nextValue) => {
          onChange?.(nextValue ?? "");
        }}
        onMount={(editorInstance, monacoInstance) => {
          editorInstance.addCommand(
            monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
            () => {
              if (!readOnly) {
                onSave?.();
              }
            },
          );
        }}
        options={{
          automaticLayout: true,
          fontFamily:
            "'Source Code Pro', ui-monospace, SFMono-Regular, monospace",
          fontLigatures: false,
          fontSize: 12,
          glyphMargin: false,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          padding: { top: 16, bottom: 16 },
          readOnly,
          renderLineHighlight: "gutter",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          tabSize: 2,
          wordWrap: "on",
        }}
      />
    </div>
  );
}
