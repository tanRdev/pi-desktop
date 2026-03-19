import {
  ResetButton,
  SettingsRow,
  SettingsSection,
  SettingsSlider,
} from "../form-components";
import { useSettings } from "../settings-context";

export function InterfaceSettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const ui = settings.interface;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Layout"
        description="Adjust the only interface preference currently wired into the workspace"
      >
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
      </SettingsSection>

      <div className="flex justify-end pt-4">
        <ResetButton onClick={() => resetSection("interface")} />
      </div>
    </div>
  );
}
