/**
 * Monaco code editor component for file editing.
 */

import Editor, { type OnChange, type OnMount } from "@monaco-editor/react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Language ID mapping from file extensions.
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".ps1": "powershell",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "scss",
  ".less": "less",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".svg": "xml",
  ".sql": "sql",
  ".md": "markdown",
  ".markdown": "markdown",
  ".php": "php",
  ".vue": "vue",
  ".svelte": "svelte",
  ".lua": "lua",
  ".r": "r",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
  ".hs": "haskell",
  ".jl": "julia",
  ".pl": "perl",
  ".scala": "scala",
  ".clj": "clojure",
  ".erl": "erlang",
  ".dockerfile": "dockerfile",
  ".makefile": "makefile",
  ".mk": "makefile",
  ".nix": "nix",
  ".prisma": "prisma",
  ".graphql": "graphql",
  ".gql": "graphql",
};

/**
 * Get the Monaco language ID from a file path.
 */
export function getLanguageFromPath(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return "plaintext";
  const ext = path.slice(lastDot).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? "plaintext";
}

/**
 * Props for CodeEditor component.
 */
export interface CodeEditorProps {
  /** File path for language detection */
  filePath?: string;
  /** Initial content */
  value?: string;
  /** Language override */
  language?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Called when content changes */
  onChange?: (value: string) => void;
  /** Called when editor mounts */
  onMount?: (
    editor: Parameters<OnMount>[0],
    monaco: Parameters<OnMount>[1],
  ) => void;
  /** Additional class name */
  className?: string;
  /** Theme override */
  theme?: "vs-dark" | "light" | "vs";
}

/**
 * Code editor component using Monaco.
 */
export function CodeEditor({
  filePath,
  value = "",
  language,
  readOnly = false,
  onChange,
  onMount,
  className,
  theme = "vs-dark",
}: CodeEditorProps) {
  const editorRef = React.useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
      lineNumbers: "on",
      renderLineHighlight: "line",
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      readOnly,
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
    });

    // Focus the editor
    editor.focus();

    // Call user callback
    onMount?.(editor, monaco);
  };

  const handleChange: OnChange = (value) => {
    onChange?.(value ?? "");
  };

  // Determine language from file path if not provided
  const detectedLanguage =
    language ?? (filePath ? getLanguageFromPath(filePath) : "plaintext");

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden",
        "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
        "motion-reduce:animate-none",
        className,
      )}
    >
      <Editor
        height="100%"
        language={detectedLanguage}
        value={value}
        theme={theme}
        onChange={handleChange}
        onMount={handleMount}
        loading={
          <div
            className={cn(
              "flex h-full items-center justify-center text-muted-foreground",
              "animate-in fade-in zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "size-4 animate-spin rounded-full border-2 border-border border-t-primary",
                  "transition-all duration-150 [transition-timing-function:var(--ease-out)]",
                )}
              />
              Loading editor...
            </div>
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
          readOnly,
        }}
      />
    </div>
  );
}
