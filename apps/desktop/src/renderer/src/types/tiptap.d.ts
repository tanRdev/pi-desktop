declare module "@tiptap/react" {
  import * as React from "react";

  export interface Editor {
    getHTML(): string;
    commands: {
      setContent(content: string, emitUpdate?: boolean): void;
      clearContent(emitUpdate?: boolean): void;
      insertContent(content: string): void;
    };
    setEditable(editable: boolean): void;
  }

  export interface EditorOptions {
    extensions?: unknown[];
    content?: string;
    editable?: boolean;
    onUpdate?: (props: { editor: Editor }) => void;
  }

  export type OnMount = never;
  export function useEditor(options?: EditorOptions): Editor | null;
  export const EditorContent: React.ComponentType<{
    editor: Editor | null;
    className?: string;
  }>;
}

declare module "@tiptap/starter-kit" {
  const StarterKit: unknown;
  export default StarterKit;
}

declare module "@tiptap/extension-placeholder" {
  const Placeholder: {
    configure(options: { placeholder: string }): unknown;
  };
  export default Placeholder;
}

declare module "@tiptap/extension-mathematics" {
  const Mathematics: {
    configure(options?: Record<string, unknown>): unknown;
  };
  export default Mathematics;
}
