import { useState } from "react";
import { useKeyboardShortcut } from "@/lib/keyboard";
import { SessionHealthPanel } from "./session-health-panel";
import type { UseSessionHealthOptions } from "./use-session-health";
import { useSessionHealth } from "./use-session-health";

export interface SessionHealthHostProps {
  defaultOpen?: boolean;
  healthOptions?: UseSessionHealthOptions;
}

export function SessionHealthHost({
  defaultOpen = false,
  healthOptions,
}: SessionHealthHostProps = {}) {
  const [open, setOpen] = useState(defaultOpen);

  useKeyboardShortcut(
    {
      id: "session-health.toggle",
      keys: "Mod+Shift+D",
      description: "Toggle session health panel",
      group: "Debug",
      allowInInput: true,
    },
    () => {
      setOpen((prev) => !prev);
    },
  );

  const { snapshot } = useSessionHealth(healthOptions);

  if (!open) return null;

  return <SessionHealthPanel snapshot={snapshot} />;
}

export type {
  ConnectionStatus,
  SessionHealthSnapshot,
} from "./use-session-health";
