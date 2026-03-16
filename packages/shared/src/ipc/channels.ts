export const IPC_CHANNELS = {
  shell: {
    getSnapshot: "shell:getSnapshot",
  },
  agent: {
    event: "agent:event",
    getProviders: "agent:getProviders",
    getSettings: "agent:getSettings",
    getSnapshot: "agent:getSnapshot",
    prompt: "agent:prompt",
    reset: "agent:reset",
  },
  repositories: {
    add: "repositories:add",
    select: "repositories:select",
  },
  worktrees: {
    create: "worktrees:create",
    select: "worktrees:select",
  },
  threads: {
    create: "threads:create",
    select: "threads:select",
  },
  dialog: {
    showOpenDialog: "dialog:showOpenDialog",
  },
  fs: {
    readDirectory: "fs:readDirectory",
    readFile: "fs:readFile",
    writeFile: "fs:writeFile",
  },
  terminal: {
    create: "terminal:create",
    write: "terminal:write",
    resize: "terminal:resize",
    destroy: "terminal:destroy",
  },
} as const;

export type IpcChannels = typeof IPC_CHANNELS;
