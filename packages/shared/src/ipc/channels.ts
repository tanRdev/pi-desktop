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
    switchModel: "agent:switchModel",
    getDiscovery: "agent:getDiscovery",
    getSlashSuggestions: "agent:getSlashSuggestions",
  },
  repositories: {
    add: "repositories:add",
    reorder: "repositories:reorder",
    select: "repositories:select",
  },
  worktrees: {
    create: "worktrees:create",
    select: "worktrees:select",
  },
  threads: {
    create: "threads:create",
    select: "threads:select",
    archive: "threads:archive",
    rename: "threads:rename",
    routeToTerminal: "threads:routeToTerminal",
  },
  dialog: {
    showOpenDialog: "dialog:showOpenDialog",
  },
  fs: {
    readDirectory: "fs:readDirectory",
    readFile: "fs:readFile",
    writeFile: "fs:writeFile",
    getImageMetadata: "fs:getImageMetadata",
    getImagePreview: "fs:getImagePreview",
  },
  terminal: {
    create: "terminal:create",
    write: "terminal:write",
    resize: "terminal:resize",
    destroy: "terminal:destroy",
    getSessions: "terminal:getSessions",
  },
  search: {
    searchFiles: "search:searchFiles",
  },
  state: {
    getRepositoryPreferences: "state:getRepositoryPreferences",
    updateRepositoryPreferences: "state:updateRepositoryPreferences",
    getWorkspaceSession: "state:getWorkspaceSession",
    saveWorkspaceSession: "state:saveWorkspaceSession",
    getAppPreferences: "state:getAppPreferences",
    updateAppPreferences: "state:updateAppPreferences",
    importLegacyPreferences: "state:importLegacyPreferences",
  },
  window: {
    create: "window:create",
    close: "window:close",
    focus: "window:focus",
    fullscreenChanged: "window:fullscreenChanged",
    getFullscreenState: "window:getFullscreenState",
    move: "window:move",
    resize: "window:resize",
    minimize: "window:minimize",
    maximize: "window:maximize",
    restore: "window:restore",
    getLayout: "window:getLayout",
  },
} as const;

export type IpcChannels = typeof IPC_CHANNELS;
