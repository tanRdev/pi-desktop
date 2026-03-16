import { useSettings } from "../settings-context";
import {
  SettingsSection,
  SettingsRow,
  SettingsSelect,
  SettingsSwitch,
  SettingsSlider,
  SettingsNumberInput,
  SettingsDivider,
  ResetButton,
} from "../form-components";
import { CURSOR_STYLES } from "../defaults";

export function TerminalSettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const terminal = settings.terminal;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Shell"
        description="Configure your terminal shell"
      >
        <SettingsRow label="Shell" description="Default shell to use">
          <select
            value={terminal.shell}
            onChange={(e) => updateSettings("terminal", { shell: e.target.value })}
            className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="zsh">zsh</option>
            <option value="bash">bash</option>
            <option value="fish">fish</option>
            <option value="sh">sh</option>
          </select>
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Appearance"
        description="Terminal visual settings"
      >
        <SettingsRow label="Font Family" description="Terminal font">
          <select
            value={terminal.fontFamily}
            onChange={(e) => updateSettings("terminal", { fontFamily: e.target.value })}
            className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Fira Code">Fira Code</option>
            <option value="Menlo">Menlo</option>
            <option value="Monaco">Monaco</option>
          </select>
        </SettingsRow>

        <SettingsRow label="Font Size" description="Terminal font size">
          <SettingsSlider
            value={terminal.fontSize}
            onChange={(value) => updateSettings("terminal", { fontSize: value })}
            min={10}
            max={24}
            step={1}
          />
        </SettingsRow>

        <SettingsRow label="Line Height" description="Line height multiplier">
          <SettingsSlider
            value={terminal.lineHeight}
            onChange={(value) => updateSettings("terminal", { lineHeight: value })}
            min={1}
            max={2}
            step={0.1}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Cursor"
        description="Cursor appearance"
      >
        <SettingsRow label="Cursor Style" description="Cursor shape">
          <SettingsSelect
            value={terminal.cursorStyle}
            onChange={(value) => updateSettings("terminal", { cursorStyle: value as typeof terminal.cursorStyle })}
            options={CURSOR_STYLES}
          />
        </SettingsRow>

        <SettingsRow label="Cursor Blink" description="Enable cursor blinking">
          <SettingsSwitch
            checked={terminal.cursorBlink}
            onChange={(checked) => updateSettings("terminal", { cursorBlink: checked })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Behavior"
        description="Terminal behavior settings"
      >
        <SettingsRow label="Scrollback" description="Lines to keep in history">
          <SettingsNumberInput
            value={terminal.scrollback}
            onChange={(value) => updateSettings("terminal", { scrollback: value })}
            min={100}
            max={100000}
            step={1000}
            className="w-[120px]"
          />
        </SettingsRow>

        <SettingsRow label="Bell Sound" description="Play sound on bell">
          <SettingsSwitch
            checked={terminal.bellSound}
            onChange={(checked) => updateSettings("terminal", { bellSound: checked })}
          />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end pt-4">
        <ResetButton onClick={() => resetSection("terminal")} />
      </div>
    </div>
  );
}