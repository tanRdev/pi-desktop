import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  ai: {
    provider: "google",
    apiKey: "",
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.95,
    topK: 40,
    contextWindow: 128000,
    baseUrl: "",
    systemPrompt: "",
  },
  interface: {
    theme: "system",
    accentColor: "blue",
    fontSize: 14,
    fontFamily: "Inter",
    codeFontFamily: "JetBrains Mono",
    codeFontSize: 13,
    sidebarPosition: "left",
    sidebarWidth: 280,
    showLineNumbers: true,
    reduceMotion: false,
  },
  editor: {
    fontFamily: "JetBrains Mono",
    fontSize: 14,
    tabSize: 2,
    wordWrap: "off",
    lineNumbers: "on",
    minimap: true,
    autoSave: true,
    autoSaveDelay: 1000,
    formatOnSave: true,
    bracketPairColorization: true,
    cursorBlinking: "blink",
    lineHeight: 1.5,
  },
  terminal: {
    shell: "zsh",
    fontFamily: "JetBrains Mono",
    fontSize: 13,
    cursorStyle: "block",
    cursorBlink: true,
    scrollback: 10000,
    lineHeight: 1.2,
    bellSound: false,
  },
  keybindings: {
    preset: "vscode",
    vimMode: false,
    customKeybindings: {},
  },
  advanced: {
    telemetryEnabled: false,
    experimentalFeatures: false,
    debugMode: false,
    logLevel: "info",
    updateChannel: "stable",
    proxyUrl: "",
    timeout: 30000,
    maxConcurrentRequests: 5,
  },
};

export const STORAGE_KEY = "pidesk-settings";

export const AI_PROVIDERS = [
  { value: "google", label: "Google AI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "custom", label: "Custom" },
] as const;

export const GOOGLE_MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.0-pro", label: "Gemini 2.0 Pro" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
] as const;

export const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
] as const;

export const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
] as const;

export const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export const ACCENT_COLORS = [
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "pink", label: "Pink" },
] as const;

export const SIDEBAR_POSITIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
] as const;

export const KEYBINDING_PRESETS = [
  { value: "vscode", label: "VS Code" },
  { value: "jetbrains", label: "JetBrains" },
  { value: "sublime", label: "Sublime Text" },
  { value: "vim", label: "Vim" },
  { value: "custom", label: "Custom" },
] as const;

export const LOG_LEVELS = [
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warning" },
  { value: "error", label: "Error" },
] as const;

export const UPDATE_CHANNELS = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta" },
  { value: "nightly", label: "Nightly" },
] as const;

export const CURSOR_STYLES = [
  { value: "block", label: "Block" },
  { value: "underline", label: "Underline" },
  { value: "bar", label: "Bar" },
] as const;

export const CURSOR_BLINKING_OPTIONS = [
  { value: "blink", label: "Blink" },
  { value: "smooth", label: "Smooth" },
  { value: "phase", label: "Phase" },
  { value: "expand", label: "Expand" },
  { value: "solid", label: "Solid" },
] as const;

export const WORD_WRAP_OPTIONS = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
  { value: "bounded", label: "Bounded" },
] as const;

export const LINE_NUMBER_OPTIONS = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
  { value: "relative", label: "Relative" },
] as const;
