import { useTheme } from "@/lib/theme";
import { useZoom } from "@/lib/zoom";
import {
  SettingsNumberInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsTextInput,
  SettingsToggle,
} from "../controls";
import type { SettingsUpdater, UiSettings } from "../use-settings";

export function AppearanceSection({
  settings,
  update,
}: {
  settings: UiSettings;
  update: (updater: SettingsUpdater) => void;
}) {
  const { theme, setTheme } = useTheme();
  const { zoom, setZoom } = useZoom();

  return (
    <SettingsSection
      title="Appearance"
      description="Control how Pi Desktop looks and feels."
    >
      <SettingsRow
        label="Theme"
        description="Use system, light, or dark theme."
        htmlFor="settings-theme"
      >
        <SettingsSelect
          id="settings-theme"
          value={theme}
          onChange={(value) => {
            const next =
              value === "light" || value === "dark" || value === "system"
                ? value
                : "system";
            setTheme(next);
          }}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </SettingsRow>
      <SettingsRow
        label="Zoom"
        description="Scale the entire interface."
        htmlFor="settings-zoom"
      >
        <SettingsNumberInput
          id="settings-zoom"
          value={Math.round(zoom * 100)}
          min={50}
          max={300}
          step={10}
          suffix="%"
          onChange={(value) => setZoom(value / 100)}
        />
      </SettingsRow>
      <SettingsRow
        label="Font family"
        description="Primary UI typeface."
        htmlFor="settings-font-family"
      >
        <SettingsTextInput
          id="settings-font-family"
          value={settings.fontFamily}
          onChange={(value) =>
            update((prev) => ({ ...prev, fontFamily: value }))
          }
          placeholder="Inter Variable"
        />
      </SettingsRow>
      <SettingsRow
        label="Font size"
        description="Base size for interface text."
        htmlFor="settings-font-size"
      >
        <SettingsNumberInput
          id="settings-font-size"
          value={settings.fontSize}
          min={10}
          max={24}
          step={1}
          suffix="px"
          onChange={(value) => update((prev) => ({ ...prev, fontSize: value }))}
        />
      </SettingsRow>
      <SettingsRow
        label="Reduce motion"
        description="Minimise animations throughout the app."
        htmlFor="settings-reduced-motion"
      >
        <SettingsToggle
          id="settings-reduced-motion"
          label="Reduce motion"
          checked={settings.reducedMotion}
          onChange={(value) =>
            update((prev) => ({ ...prev, reducedMotion: value }))
          }
        />
      </SettingsRow>
    </SettingsSection>
  );
}
