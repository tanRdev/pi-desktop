// Settings Context
export { SettingsProvider, useSettings } from "./settings-context";

// Settings Modal
export { SettingsModal } from "./settings-modal";

// Types
export type {
  Settings,
  AISettings,
  InterfaceSettings,
  EditorSettings,
  TerminalSettings,
  KeybindingSettings,
  AdvancedSettings,
  SettingsContextValue,
  SettingsSection as SettingsSectionKey,
  Theme,
  AccentColor,
  SidebarPosition,
  UpdateChannel,
  LogLevel,
} from "./types";

// Defaults
export {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  AI_PROVIDERS,
  GOOGLE_MODELS,
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  THEME_OPTIONS,
  ACCENT_COLORS,
  SIDEBAR_POSITIONS,
  KEYBINDING_PRESETS,
  LOG_LEVELS,
  UPDATE_CHANNELS,
  CURSOR_STYLES,
  CURSOR_BLINKING_OPTIONS,
  WORD_WRAP_OPTIONS,
  LINE_NUMBER_OPTIONS,
} from "./defaults";

// Form Components
export {
  SettingsSection,
  SettingsRow,
  SettingsSelect,
  SettingsSwitch,
  SettingsSlider,
  SettingsInput,
  SettingsNumberInput,
  SettingsTextarea,
  SettingsDivider,
  ResetButton,
} from "./form-components";

// Section Components
export {
  AISettingsSection,
  InterfaceSettingsSection,
  EditorSettingsSection,
  TerminalSettingsSection,
  KeybindingsSettingsSection,
  AdvancedSettingsSection,
} from "./sections";