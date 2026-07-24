import { useCallback, useEffect, useState } from "react";
import { SettingsRow, SettingsSection, SettingsToggle } from "../controls";

export function UpdatesSection() {
  const [autoDownload, setAutoDownload] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.piDesktop.state
      .getAppPreferences()
      .then((prefs) => {
        if (!cancelled) {
          setAutoDownload(prefs.autoDownloadUpdates === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAutoDownload(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(async (next: boolean) => {
    setAutoDownload(next);
    setIsBusy(true);
    try {
      await window.piDesktop.state.updateAppPreferences({
        autoDownloadUpdates: next,
      });
    } catch {
      setAutoDownload((current) => !current);
    } finally {
      setIsBusy(false);
    }
  }, []);

  return (
    <SettingsSection
      title="Updates"
      description="Control how Pi Desktop downloads app updates."
    >
      <SettingsRow
        label="Auto-download updates"
        description="When an update is available, download it in the background. You still choose when to install and restart."
        htmlFor="settings-auto-download-updates"
      >
        <SettingsToggle
          id="settings-auto-download-updates"
          checked={autoDownload}
          onChange={(next) => {
            void handleToggle(next);
          }}
          label="Auto-download updates"
          disabled={isBusy}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
