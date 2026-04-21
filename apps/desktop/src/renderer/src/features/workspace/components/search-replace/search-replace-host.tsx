import * as React from "react";
import { useKeyboardShortcut } from "@/lib/keyboard";
import { SearchReplacePanel } from "./search-replace-panel";

const EMPTY_FILES: ReadonlyArray<{ filePath: string; content: string }> = [];

export interface SearchReplaceHostProps {
  readonly files?: ReadonlyArray<{ filePath: string; content: string }>;
  readonly onReplace?: (filePath: string, content: string) => void;
  readonly defaultOpen?: boolean;
}

export function SearchReplaceHost({
  files = EMPTY_FILES,
  onReplace,
  defaultOpen = false,
}: SearchReplaceHostProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  useKeyboardShortcut(
    {
      id: "search-replace.toggle",
      keys: "Mod+H",
      description: "Toggle search and replace panel",
      group: "View",
      allowInInput: true,
    },
    () => {
      setOpen((prev) => !prev);
    },
  );

  return (
    <SearchReplacePanel
      open={open}
      onOpenChange={setOpen}
      files={files}
      onReplace={onReplace}
    />
  );
}
