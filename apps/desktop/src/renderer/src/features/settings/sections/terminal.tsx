import {
  SettingsNumberInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsTextInput,
} from "../controls";
import type { SettingsUpdater, UiSettings } from "../use-settings";

export function TerminalSection({
  settings,
  update,
}: {
  settings: UiSettings;
  update: (updater: SettingsUpdater) => void;
}) {
  return (
    <SettingsSection
      title="Terminal"
      description="How embedded terminals render text and history."
    >
      <SettingsRow label="Font family" htmlFor="settings-terminal-font-family">
        <SettingsTextInput
          id="settings-terminal-font-family"
          value={settings.terminal.fontFamily}
          placeholder="Source Code Pro"
          onChange={(value) =>
            update((prev) => ({
              ...prev,
              terminal: { ...prev.terminal, fontFamily: value },
            }))
          }
        />
      </SettingsRow>
      <SettingsRow label="Font size" htmlFor="settings-terminal-font-size">
        <SettingsNumberInput
          id="settings-terminal-font-size"
          value={settings.terminal.fontSize}
          min={8}
          max={24}
          step={1}
          suffix="px"
          onChange={(value) =>
            update((prev) => ({
              ...prev,
              terminal: { ...prev.terminal, fontSize: value },
            }))
          }
        />
      </SettingsRow>
      <SettingsRow
        label="Scrollback"
        description="Number of lines kept in terminal history."
        htmlFor="settings-terminal-scrollback"
      >
        <SettingsNumberInput
          id="settings-terminal-scrollback"
          value={settings.terminal.scrollback}
          min={100}
          max={100000}
          step={100}
          suffix="lines"
          onChange={(value) =>
            update((prev) => ({
              ...prev,
              terminal: { ...prev.terminal, scrollback: value },
            }))
          }
        />
      </SettingsRow>
      <SettingsRow label="Cursor style" htmlFor="settings-terminal-cursor">
        <SettingsSelect
          id="settings-terminal-cursor"
          value={settings.terminal.cursorStyle}
          onChange={(value) => {
            const next =
              value === "block" || value === "bar" || value === "underline"
                ? value
                : "block";
            update((prev) => ({
              ...prev,
              terminal: { ...prev.terminal, cursorStyle: next },
            }));
          }}
          options={[
            { value: "block", label: "Block" },
            { value: "bar", label: "Bar" },
            { value: "underline", label: "Underline" },
          ]}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
