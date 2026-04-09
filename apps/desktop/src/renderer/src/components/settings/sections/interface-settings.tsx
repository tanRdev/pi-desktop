import { cn } from "@/lib/utils";
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
        description="Trim the desktop shell to the density that feels closest to Cursor."
      >
        <div
          className={cn("transition-all duration-200 ease-[var(--ease-out)] stagger-item")}
          style={{
            animationDelay: "0ms",
            animationFillMode: "forwards",
          }}
        >
          <SettingsRow
            label="Sidebar Width"
            description="Controls the project rail width for the active desktop shell"
          >
            <SettingsSlider
              testId="settings-sidebar-width-slider"
              ariaLabel="Sidebar Width"
              value={ui.sidebarWidth}
              onChange={(value) =>
                updateSettings("interface", { sidebarWidth: value })
              }
              min={200}
              max={400}
              step={10}
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      <div
        className={cn("flex justify-end pt-4 stagger-item")}
        style={{
          animationDelay: "40ms",
          animationFillMode: "forwards",
        }}
      >
        <ResetButton
          label="Reset layout"
          onClick={() => resetSection("interface")}
        />
      </div>
    </div>
  );
}
