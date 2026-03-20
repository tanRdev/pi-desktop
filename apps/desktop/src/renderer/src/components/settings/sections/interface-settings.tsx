import { cn } from "@/lib/utils";
import {
  ResetButton,
  SettingsRow,
  SettingsSection,
  SettingsSlider,
} from "../form-components";
import { useSettings } from "../settings-context";

// Custom easing for Emil Design
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export function InterfaceSettingsSection() {
  const { settings, updateSettings, resetSection } = useSettings();
  const ui = settings.interface;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Layout"
        description="Adjust the only interface preference currently wired into the workspace"
      >
        <div
          className={cn("transition-all duration-200 stagger-item")}
          style={{
            animationDelay: "0ms",
            animationFillMode: "forwards",
            transitionTimingFunction: EASE_OUT,
          }}
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
        </div>
      </SettingsSection>

      <div
        className={cn(
          "flex justify-end pt-4 stagger-item"
        )}
        style={{
          animationDelay: "40ms",
          animationFillMode: "forwards",
        }}
      >
        <ResetButton onClick={() => resetSection("interface")} />
      </div>
    </div>
  );
}
