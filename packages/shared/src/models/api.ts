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
    prompt(text: string): Promise<void>;
    reset(): Promise<void>;
    subscribe(listener: (event: PiDeskAgentEvent) => void): () => void;
  };
  repositories: {
    add(path: string): Promise<void>;
    select(repositoryId: string): Promise<void>;
  };
  worktrees: {
    create(repositoryId: string, branchName: string): Promise<void>;
    select(worktreeId: string): Promise<void>;
  };
  threads: {
    create(worktreeId: string, title?: string): Promise<void>;
    select(threadId: string): Promise<void>;
  };
  dialog: {
    showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
  };
  fs: {
    readDirectory(path: string): Promise<import("./fs.js").DirectoryListing>;
    readFile(path: string): Promise<import("./fs.js").FileContent>;
    writeFile(path: string, content: string): Promise<void>;
  };
  terminal: {
    create(
      id: string,
      options: { cols: number; rows: number; cwd?: string },
    ): Promise<void>;
    write(id: string, data: string): Promise<void>;
    resize(id: string, cols: number, rows: number): Promise<void>;
    destroy(id: string): Promise<void>;
    onEvent(
      listener: (event: {
        type: string;
        id: string;
        data?: string;
        exitCode?: number;
      }) => void,
    ): () => void;
  };
}
