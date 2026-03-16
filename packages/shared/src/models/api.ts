import type {
  AgentSnapshot,
  PiDeskAgentEvent,
  ProviderSnapshot,
  SettingsSnapshot,
} from "./agent.js";
import type { OpenDialogOptions } from "./dialog.js";
import type { ShellSnapshot } from "./shell.js";

export interface PiDeskApi {
  shell: {
    getSnapshot(): Promise<ShellSnapshot>;
  };
  agent: {
    getProviders(): Promise<ProviderSnapshot[]>;
    getSettings(): Promise<SettingsSnapshot>;
    getSnapshot(): Promise<AgentSnapshot>;
    // Start a fresh agent thread / session. Should return once the
    // agent runtime has reset and is ready to accept prompts again.
    prompt(text: string): Promise<void>;
    reset(): Promise<void>;
    switchWorkspace(path: string): Promise<void>;
    subscribe(listener: (event: PiDeskAgentEvent) => void): () => void;
  };
  dialog: {
    showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
  };
  fs: {
    readDirectory(path: string): Promise<import("./fs.js").DirectoryListing>;
    readFile(path: string): Promise<import("./fs.js").FileContent>;
  };
}
