import { ACCENT_COLORS, SIDEBAR_POSITIONS, THEME_OPTIONS } from "../defaults";
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

export function InterfaceSettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const ui = settings.interface;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Appearance"
        description="Customize the look and feel"
      >
        <SettingsRow label="Theme" description="Color theme preference">
          <SettingsSelect
            value={ui.theme}
            onChange={(value) =>
              updateSettings("interface", { theme: value as typeof ui.theme })
            }
            options={THEME_OPTIONS}
          />
        </SettingsRow>

        <SettingsRow label="Accent Color" description="Primary accent color">
          <SettingsSelect
            value={ui.accentColor}
            onChange={(value) =>
              updateSettings("interface", {
                accentColor: value as typeof ui.accentColor,
              })
            }
            options={ACCENT_COLORS}
          />
        </SettingsRow>

        <SettingsRow label="Reduce Motion" description="Minimize animations">
          <SettingsSwitch
            checked={ui.reduceMotion}
            onChange={(checked) =>
              updateSettings("interface", { reduceMotion: checked })
            }
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection title="Typography" description="Font and text settings">
        <SettingsRow label="Font Size" description="Base font size in pixels">
          <SettingsSlider
            value={ui.fontSize}
            onChange={(value) =>
              updateSettings("interface", { fontSize: value })
            }
            min={10}
            max={20}
            step={1}
          />
        </SettingsRow>

        <SettingsRow label="Interface Font" description="UI font family">
          <select
            value={ui.fontFamily}
            onChange={(e) =>
              updateSettings("interface", { fontFamily: e.target.value })
            }
            className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="Inter">Inter</option>
            <option value="SF Pro">SF Pro</option>
            <option value="System">System</option>
          </select>
        </SettingsRow>

        <SettingsRow label="Code Font" description="Monospace font for code">
          <select
            value={ui.codeFontFamily}
            onChange={(e) =>
              updateSettings("interface", { codeFontFamily: e.target.value })
            }
            className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Fira Code">Fira Code</option>
            <option value="Menlo">Menlo</option>
            <option value="Monaco">Monaco</option>
          </select>
        </SettingsRow>

        <SettingsRow
          label="Code Font Size"
          description="Font size for code blocks"
        >
          <SettingsSlider
            value={ui.codeFontSize}
            onChange={(value) =>
              updateSettings("interface", { codeFontSize: value })
            }
            min={10}
            max={18}
            step={1}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Layout"
        description="Window and panel arrangement"
      >
        <SettingsRow
          label="Sidebar Position"
          description="Position of the sidebar"
        >
          <SettingsSelect
            value={ui.sidebarPosition}
            onChange={(value) =>
              updateSettings("interface", {
                sidebarPosition: value as typeof ui.sidebarPosition,
              })
            }
            options={SIDEBAR_POSITIONS}
          />
        </SettingsRow>

        <SettingsRow
          label="Sidebar Width"
          description="Width of the sidebar in pixels"
        >
          <SettingsSlider
            value={ui.sidebarWidth}
            onChange={(value) =>
              updateSettings("interface", { sidebarWidth: value })
            }
            min={200}
            max={400}
            step={10}
          />
        </SettingsRow>

        <SettingsRow
          label="Show Line Numbers"
          description="Display line numbers in editor"
        >
          <SettingsSwitch
            checked={ui.showLineNumbers}
            onChange={(checked) =>
              updateSettings("interface", { showLineNumbers: checked })
            }
          />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end pt-4">
        <ResetButton onClick={() => resetSection("interface")} />
      </div>
    </div>
  );
}
