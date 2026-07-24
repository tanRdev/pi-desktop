import { useEffect } from "react";
import { applyUiSettingsToDocument } from "./apply-ui-settings";
import { useSettings } from "./use-settings";

/**
 * Mount-once side effects that push UiSettings onto the document.
 * Render near the app root (inside SettingsHost is fine).
 */
export function SettingsEffects() {
  const { settings } = useSettings();

  useEffect(() => {
    applyUiSettingsToDocument(settings);
  }, [settings]);

  return null;
}
