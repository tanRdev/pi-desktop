import { Button } from "@/components/ui/button";
import { FolderOpen, Trash } from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import { SettingsRow, SettingsSection } from "../controls";

export function DangerZoneSection({
  onResetPreferences,
}: {
  onResetPreferences: () => void;
}) {
  const handleClearCache = async () => {
    try {
      // Cache-clear IPC is not yet exposed. When it lands, invoke it here.
      if (typeof globalThis.caches !== "undefined") {
        const names = await globalThis.caches.keys();
        await Promise.all(names.map((name) => globalThis.caches.delete(name)));
      }
      toast.success("Cache cleared");
    } catch {
      toast.error("Could not clear cache");
    }
  };

  const handleRevealDataFolder = () => {
    try {
      // Reveal-data-folder IPC isn't exposed yet. Stubbed via toast so the UI
      // communicates intent without pretending work happened.
      toast.info("Reveal data folder", {
        description: "This action will open the Pi Desktop data directory.",
      });
    } catch {
      toast.error("Could not reveal data folder");
    }
  };

  const handleReset = () => {
    try {
      onResetPreferences();
      toast.success("Preferences reset to defaults");
    } catch {
      toast.error("Could not reset preferences");
    }
  };

  return (
    <SettingsSection
      title="Danger zone"
      description="These actions are destructive and cannot be undone."
    >
      <SettingsRow
        label="Clear cache"
        description="Remove locally cached data and rebuild on next use."
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleClearCache()}
        >
          <Trash className="size-3.5" />
          Clear cache
        </Button>
      </SettingsRow>
      <SettingsRow
        label="Reset preferences"
        description="Restore every Settings value to its default."
      >
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleReset}
        >
          Reset preferences
        </Button>
      </SettingsRow>
      <SettingsRow
        label="Reveal data folder"
        description="Open the Pi Desktop application support directory."
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRevealDataFolder}
        >
          <FolderOpen className="size-3.5" />
          Reveal in Finder
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
