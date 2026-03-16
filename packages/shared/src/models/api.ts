import type { AgentSnapshot, PiDeskAgentEvent } from "./agent.js";
import type { ShellSnapshot } from "./shell.js";
import type { OpenDialogOptions } from "./dialog.js";

export interface PiDeskApi {
  shell: {
    getSnapshot(): Promise<ShellSnapshot>;
  };
  agent: {
    getSnapshot(): Promise<AgentSnapshot>;
    // Start a fresh agent thread / session. Should return once the
    // agent runtime has reset and is ready to accept prompts again.
    prompt(text: string): Promise<void>;
    reset(): Promise<void>;
    subscribe(listener: (event: PiDeskAgentEvent) => void): () => void;
  },
  dialog: {
    showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
  };
}
