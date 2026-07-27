import { Button } from "@pi-desktop/ui";
import { useCallback, useEffect, useState } from "react";
import { useUpdater } from "@/hooks/use-updater";
import { SettingsRow, SettingsSection, SettingsToggle } from "../controls";

export function UpdatesSection() {
  const { state, actions, isAvailable, isDownloaded, isError } = useUpdater();
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

  const statusLabel = (() => {
    switch (state.status) {
      case "checking":
        return "Checking for updates…";
      case "available":
        return `Pi Desktop ${state.updateInfo?.version ?? ""} is available`;
      case "downloading":
        return `Downloading ${Math.round(state.downloadPercent)}%`;
      case "downloaded":
        return `Pi Desktop ${state.updateInfo?.version ?? ""} is ready to install`;
      case "restart-pending":
        return "Restarting to install…";
      case "error":
        return state.error?.message ?? "Update check failed";
      default:
        return state.lastCheckAt
          ? "Pi Desktop is up to date"
          : "Not checked yet";
    }
  })();

  const updateAction = (() => {
    if (isDownloaded) {
      return (
        <Button size="xs" onClick={actions.install}>
          Restart and install
        </Button>
      );
    }
    if (isAvailable) {
      return (
        <Button
          size="xs"
          onClick={() => {
            void actions.download();
          }}
        >
          Download update
        </Button>
      );
    }
    return (
      <Button
        size="xs"
        variant="outline"
        disabled={
          state.status === "checking" ||
          state.status === "downloading" ||
          state.status === "restart-pending"
        }
        onClick={() => {
          void actions.check();
        }}
      >
        {isError ? "Try again" : "Check for updates"}
      </Button>
    );
  })();

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
      <SettingsRow label="Software update" description={statusLabel}>
        {updateAction}
      </SettingsRow>

      {state.status === "downloading" ? (
        <div
          className="h-1 overflow-hidden rounded-full bg-white/[0.08]"
          role="progressbar"
          aria-label="Update download progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.downloadPercent)}
        >
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-[var(--duration-fast)]"
            style={{ width: `${state.downloadPercent}%` }}
          />
        </div>
      ) : null}

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
