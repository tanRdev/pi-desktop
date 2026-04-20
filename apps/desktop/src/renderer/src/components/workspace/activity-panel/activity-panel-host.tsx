import { useState } from "react";
import { useKeyboardShortcut } from "@/lib/keyboard";
import type { ActivityLogStream } from "./activity-log-stream";
import { ActivityPanel } from "./activity-panel";

export interface ActivityPanelHostProps {
  stream?: ActivityLogStream;
  defaultOpen?: boolean;
}

export function ActivityPanelHost({
  stream,
  defaultOpen = false,
}: ActivityPanelHostProps = {}) {
  const [open, setOpen] = useState(defaultOpen);

  useKeyboardShortcut(
    {
      id: "activity-panel.toggle",
      keys: "Mod+Shift+A",
      description: "Toggle activity log panel",
      group: "App",
      allowInInput: true,
    },
    () => {
      setOpen((prev) => !prev);
    },
  );

  return <ActivityPanel open={open} onOpenChange={setOpen} stream={stream} />;
}
