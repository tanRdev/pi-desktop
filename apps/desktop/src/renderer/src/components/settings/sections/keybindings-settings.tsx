import { useSettings } from "../settings-context";
import {
  SettingsSection,
  SettingsRow,
  SettingsSelect,
  SettingsSwitch,
  SettingsDivider,
  ResetButton,
} from "../form-components";
import { KEYBINDING_PRESETS } from "../defaults";

const COMMON_KEYBINDINGS = [
  { key: "toggleSidebar", label: "Toggle Sidebar", default: "Cmd+B" },
  { key: "toggleTerminal", label: "Toggle Terminal", default: "Cmd+`" },
  { key: "newFile", label: "New File", default: "Cmd+N" },
  { key: "openFile", label: "Open File", default: "Cmd+O" },
  { key: "saveFile", label: "Save File", default: "Cmd+S" },
  { key: "saveAllFiles", label: "Save All", default: "Cmd+Shift+S" },
  { key: "find", label: "Find", default: "Cmd+F" },
  { key: "findReplace", label: "Find and Replace", default: "Cmd+H" },
  { key: "commandPalette", label: "Command Palette", default: "Cmd+Shift+P" },
  { key: "settings", label: "Open Settings", default: "Cmd+," },
  { key: "closeTab", label: "Close Tab", default: "Cmd+W" },
  { key: "nextTab", label: "Next Tab", default: "Cmd+Tab" },
];

export function KeybindingsSettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const keybindings = settings.keybindings;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Keyboard Preset"
        description="Choose a keybinding scheme"
      >
        <SettingsRow label="Preset" description="Keybinding preset">
          <SettingsSelect
            value={keybindings.preset}
            onChange={(value) => updateSettings("keybindings", { preset: value as typeof keybindings.preset })}
            options={KEYBINDING_PRESETS}
          />
        </SettingsRow>

        <SettingsRow label="Vim Mode" description="Enable Vim-style navigation">
          <SettingsSwitch
            checked={keybindings.vimMode}
            onChange={(checked) => updateSettings("keybindings", { vimMode: checked })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Keyboard Shortcuts"
        description="View and customize shortcuts"
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-b border-border pb-2 mb-2">
            <span>Action</span>
            <span>Shortcut</span>
          </div>
          {COMMON_KEYBINDINGS.map((binding) => (
            <div
              key={binding.key}
              className="grid grid-cols-2 gap-2 py-1.5 text-sm"
            >
              <span className="text-foreground">{binding.label}</span>
              <div className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-mono">
                  {keybindings.customKeybindings[binding.key] || binding.default}
                </kbd>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Customization"
        description="Click on a shortcut to customize it"
      >
        <p className="text-xs text-muted-foreground">
          Custom keybinding editing will be available in a future update. 
          For now, you can select a preset or enable Vim mode.
        </p>
      </SettingsSection>

      <div className="flex justify-end pt-4">
        <ResetButton onClick={() => resetSection("keybindings")} />
      </div>
    </div>
  );
}