import {
  SettingsNumberInput,
  SettingsRow,
  SettingsSection,
  SettingsToggle,
} from "../controls";
import type { SettingsUpdater, UiSettings } from "../use-settings";

export function EditorSection({
  settings,
  update,
}: {
  settings: UiSettings;
  update: (updater: SettingsUpdater) => void;
}) {
  return (
    <SettingsSection
      title="Editor"
      description="Defaults applied to embedded code editors."
    >
      <SettingsRow
        label="Tab size"
        description="Number of spaces per tab."
        htmlFor="settings-editor-tab-size"
      >
        <SettingsNumberInput
          id="settings-editor-tab-size"
          value={settings.editor.tabSize}
          min={1}
          max={8}
          step={1}
          onChange={(value) =>
            update((prev) => ({
              ...prev,
              editor: { ...prev.editor, tabSize: value },
            }))
          }
        />
      </SettingsRow>
      <SettingsRow
        label="Word wrap"
        description="Wrap long lines to the viewport width."
        htmlFor="settings-editor-wrap"
      >
        <SettingsToggle
          id="settings-editor-wrap"
          label="Word wrap"
          checked={settings.editor.wordWrap}
          onChange={(value) =>
            update((prev) => ({
              ...prev,
              editor: { ...prev.editor, wordWrap: value },
            }))
          }
        />
      </SettingsRow>
      <SettingsRow
        label="Line numbers"
        description="Show line numbers in the gutter."
        htmlFor="settings-editor-line-numbers"
      >
        <SettingsToggle
          id="settings-editor-line-numbers"
          label="Line numbers"
          checked={settings.editor.lineNumbers}
          onChange={(value) =>
            update((prev) => ({
              ...prev,
              editor: { ...prev.editor, lineNumbers: value },
            }))
          }
        />
      </SettingsRow>
    </SettingsSection>
  );
}
