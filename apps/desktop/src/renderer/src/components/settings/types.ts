// Settings Types for PiDesk

export type Theme = "system" | "light" | "dark";
export type AccentColor =
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "red"
  | "pink";
export type SidebarPosition = "left" | "right";
export type UpdateChannel = "stable" | "beta" | "nightly";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AISettings {
  provider: "google" | "anthropic" | "openai" | "custom";
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  contextWindow: number;
  baseUrl: string;
  systemPrompt: string;
}

export interface InterfaceSettings {
  theme: Theme;
  accentColor: AccentColor;
  fontSize: number;
  fontFamily: string;
  codeFontFamily: string;
  codeFontSize: number;
  sidebarPosition: SidebarPosition;
  sidebarWidth: number;
  showLineNumbers: boolean;
  reduceMotion: boolean;
}

export interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  tabSize: number;
  wordWrap: "on" | "off" | "bounded";
  lineNumbers: "on" | "off" | "relative";
  minimap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  formatOnSave: boolean;
  bracketPairColorization: boolean;
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  lineHeight: number;
}

export interface TerminalSettings {
  shell: string;
  fontFamily: string;
  fontSize: number;
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  scrollback: number;
  lineHeight: number;
  bellSound: boolean;
}

export interface KeybindingSettings {
  preset: "vscode" | "jetbrains" | "sublime" | "vim" | "custom";
  vimMode: boolean;
  customKeybindings: Record<string, string>;
}

export interface AdvancedSettings {
  telemetryEnabled: boolean;
  experimentalFeatures: boolean;
  debugMode: boolean;
  logLevel: LogLevel;
  updateChannel: UpdateChannel;
  proxyUrl: string;
  timeout: number;
  maxConcurrentRequests: number;
}

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
