export const IPC_CHANNELS = {
  shell: {
    getSnapshot: "shell:getSnapshot",
  },
  agent: {
    event: "agent:event",
    getSnapshot: "agent:getSnapshot",
    prompt: "agent:prompt",
    reset: "agent:reset",
  },
  dialog: {
    showOpenDialog: "dialog:showOpenDialog",
  },
} as const;

export type IpcChannels = typeof IPC_CHANNELS;
