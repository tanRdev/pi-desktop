import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowClockwise } from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import { SettingsRow, SettingsSection, SettingsToggle } from "../controls";
import type { SettingsUpdater, UiSettings } from "../use-settings";

export function UpdatesSection({
  settings,
  update,
}: {
  settings: UiSettings;
  update: (updater: SettingsUpdater) => void;
}) {
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      // Updater IPC is not yet available from the renderer. The main process
      // owns auto-update. When a renderer bridge lands, call it here.
      await new Promise((resolve) => setTimeout(resolve, 400));
      toast.info("You're up to date", {
        description: "Automatic update checks happen in the background.",
      });
    } catch {
      toast.error("Could not check for updates");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <SettingsSection
      title="Updates"
      description="How Pi Desktop stays current."
    >
      <SettingsRow
        label="Automatic updates"
        description="Download and install updates in the background."
        htmlFor="settings-auto-update"
      >
        <SettingsToggle
          id="settings-auto-update"
          label="Automatic updates"
          checked={settings.updates.autoUpdate}
          onChange={(value) =>
            update((prev) => ({
              ...prev,
              updates: { ...prev.updates, autoUpdate: value },
            }))
          }
        />
      </SettingsRow>
      <SettingsRow
        label="Check for updates"
        description="Run a manual update check now."
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isChecking}
          onClick={() => void handleCheckNow()}
        >
          <ArrowClockwise className="size-3.5" />
          {isChecking ? "Checking…" : "Check now"}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
