import {
  CURSOR_BLINKING_OPTIONS,
  LINE_NUMBER_OPTIONS,
  WORD_WRAP_OPTIONS,
} from "../defaults";
import {
  ResetButton,
  SettingsDivider,
  SettingsNumberInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSlider,
  SettingsSwitch,
} from "../form-components";
import { useSettings } from "../settings-context";

export function EditorSettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const editor = settings.editor;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Text Editing"
        description="Configure text editing behavior"
      >
        <SettingsRow label="Font Family" description="Editor font">
          <select
            value={editor.fontFamily}
            onChange={(e) =>
              updateSettings("editor", { fontFamily: e.target.value })
            }
            className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Fira Code">Fira Code</option>
            <option value="Menlo">Menlo</option>
            <option value="Monaco">Monaco</option>
          </select>
        </SettingsRow>

        <SettingsRow label="Font Size" description="Editor font size in pixels">
          <SettingsSlider
            value={editor.fontSize}
            onChange={(value) => updateSettings("editor", { fontSize: value })}
            min={10}
            max={24}
            step={1}
          />
        </SettingsRow>

        <SettingsRow label="Line Height" description="Line height multiplier">
          <SettingsSlider
            value={editor.lineHeight}
            onChange={(value) =>
              updateSettings("editor", { lineHeight: value })
            }
            min={1}
            max={2}
            step={0.1}
          />
        </SettingsRow>

        <SettingsRow label="Tab Size" description="Spaces per tab">
          <SettingsNumberInput
            value={editor.tabSize}
            onChange={(value) => updateSettings("editor", { tabSize: value })}
            min={1}
            max={8}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title="Display" description="Visual editor settings">
        <SettingsRow label="Word Wrap" description="Line wrapping behavior">
          <SettingsSelect
            value={editor.wordWrap}
            onChange={(value) =>
              updateSettings("editor", {
                wordWrap: value as typeof editor.wordWrap,
              })
            }
            options={WORD_WRAP_OPTIONS}
          />
        </SettingsRow>

        <SettingsRow label="Line Numbers" description="Show line numbers">
          <SettingsSelect
            value={editor.lineNumbers}
            onChange={(value) =>
              updateSettings("editor", {
                lineNumbers: value as typeof editor.lineNumbers,
              })
            }
            options={LINE_NUMBER_OPTIONS}
          />
        </SettingsRow>

        <SettingsRow label="Minimap" description="Show code minimap">
          <SettingsSwitch
            checked={editor.minimap}
            onChange={(checked) =>
              updateSettings("editor", { minimap: checked })
            }
          />
        </SettingsRow>

        <SettingsRow
          label="Bracket Colorization"
          description="Color matching brackets"
        >
          <SettingsSwitch
            checked={editor.bracketPairColorization}
            onChange={(checked) =>
              updateSettings("editor", { bracketPairColorization: checked })
            }
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Cursor"
        description="Cursor appearance and behavior"
      >
        <SettingsRow
          label="Cursor Blinking"
          description="Cursor animation style"
        >
          <SettingsSelect
            value={editor.cursorBlinking}
            onChange={(value) =>
              updateSettings("editor", {
                cursorBlinking: value as typeof editor.cursorBlinking,
              })
            }
            options={CURSOR_BLINKING_OPTIONS}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title="Auto Save" description="Automatic file saving">
        <SettingsRow label="Auto Save" description="Enable auto save">
          <SettingsSwitch
            checked={editor.autoSave}
            onChange={(checked) =>
              updateSettings("editor", { autoSave: checked })
            }
          />
        </SettingsRow>

        {editor.autoSave && (
          <SettingsRow
            label="Auto Save Delay"
            description="Delay in milliseconds"
          >
            <SettingsNumberInput
              value={editor.autoSaveDelay}
              onChange={(value) =>
                updateSettings("editor", { autoSaveDelay: value })
              }
              min={100}
              max={10000}
              step={100}
              className="w-[120px]"
            />
          </SettingsRow>
        )}

        <SettingsRow
          label="Format on Save"
          description="Auto-format when saving"
        >
          <SettingsSwitch
            checked={editor.formatOnSave}
            onChange={(checked) =>
              updateSettings("editor", { formatOnSave: checked })
            }
          />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end pt-4">
        <ResetButton onClick={() => resetSection("editor")} />
      </div>
    </div>
  );
}
