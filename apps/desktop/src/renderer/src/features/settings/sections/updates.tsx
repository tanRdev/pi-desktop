import { SettingsSection } from "../controls";
import type { SettingsUpdater, UiSettings } from "../use-settings";

export function UpdatesSection({
  settings: _settings,
  update: _update,
}: {
  settings: UiSettings;
  update: (updater: SettingsUpdater) => void;
}) {
  return (
    <SettingsSection
      title="Updates"
      description="This panel does not control desktop updates yet."
    >
      <div className="text-[10.5px] leading-relaxed text-white/50">
        <p>Desktop updates are not wired into this panel yet.</p>
        <p className="mt-2 text-white/40">
          When the packaged updater is available, update prompts appear in the
          app banner instead of Settings.
        </p>
      </div>
    </SettingsSection>
  );
}
