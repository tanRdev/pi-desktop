export interface AISettings {
  provider?: string;
  model?: string;
}

export interface InterfaceSettings {
  sidebarWidth: number;
}

export type EditorSettings = Record<string, never>;

export type TerminalSettings = Record<string, never>;

export type KeybindingSettings = Record<string, never>;

export type AdvancedSettings = Record<string, never>;

export interface Settings {
  ai: AISettings;
  interface: InterfaceSettings;
  editor: EditorSettings;
  terminal: TerminalSettings;
  keybindings: KeybindingSettings;
  advanced: AdvancedSettings;
}

export interface SettingsContextValue {
  settings: Settings;
  updateSettings: <K extends keyof Settings>(
    section: K,
    updates: Partial<Settings[K]>,
  ) => void;
  resetSection: (section: keyof Settings) => void;
  resetAll: () => void;
  hasUnsavedChanges: boolean;
  saveSettings: () => void;
}

export type SettingsSection = keyof Settings;
