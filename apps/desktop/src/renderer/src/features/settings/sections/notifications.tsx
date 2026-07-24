import { useCallback, useState } from "react";
import {
  getNotificationPrefs,
  type NotificationPreferences,
  setNotificationPrefs,
} from "@/features/notifications";
import { SettingsRow, SettingsSection, SettingsToggle } from "../controls";

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    getNotificationPrefs(),
  );

  const updatePref = useCallback(
    (partial: Partial<NotificationPreferences>) => {
      setPrefs(setNotificationPrefs(partial));
    },
    [],
  );

  return (
    <SettingsSection
      title="Notifications"
      description="Desktop alerts and sounds for agent and system events."
    >
      <SettingsRow
        label="Desktop notifications"
        description="Show OS notifications when the app is in the background."
        htmlFor="settings-notifications-desktop"
      >
        <SettingsToggle
          id="settings-notifications-desktop"
          label="Desktop notifications"
          checked={prefs.desktop}
          onChange={(value) => updatePref({ desktop: value })}
        />
      </SettingsRow>
      <SettingsRow
        label="Sound"
        description="Play a short alert when a notification arrives."
        htmlFor="settings-notifications-sound"
      >
        <SettingsToggle
          id="settings-notifications-sound"
          label="Sound"
          checked={prefs.sounds}
          onChange={(value) => updatePref({ sounds: value })}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
