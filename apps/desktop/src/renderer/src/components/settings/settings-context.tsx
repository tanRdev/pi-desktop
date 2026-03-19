import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShellModel } from "../../hooks/use-shell-model";
import { getEffectiveSettings } from "../../stores/app-shell-store";
import { DEFAULT_SETTINGS } from "./defaults";
import type { Settings, SettingsContextValue, SettingsSection } from "./types";

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsDraftState = {
  baseSignature: string;
  value: Settings;
};

function cloneSettings(settings: Settings): Settings {
  return {
    ai: { ...settings.ai },
    interface: { ...settings.interface },
    editor: { ...settings.editor },
    terminal: { ...settings.terminal },
    keybindings: { ...settings.keybindings },
    advanced: { ...settings.advanced },
  };
}

function cloneDefaultSettings(): Settings {
  return cloneSettings(DEFAULT_SETTINGS);
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings);
}

export function reconcileSettingsDraftState(
  draftState: SettingsDraftState | null,
  persistedSignature: string,
  acknowledgedPersistedSignatures: readonly string[],
): SettingsDraftState | null {
  if (!draftState) {
    return null;
  }

  const draftSignature = serializeSettings(draftState.value);
  if (draftSignature === persistedSignature) {
    return null;
  }

  if (draftState.baseSignature === persistedSignature) {
    return draftState;
  }

  if (acknowledgedPersistedSignatures.includes(persistedSignature)) {
    return {
      baseSignature: persistedSignature,
      value: draftState.value,
    };
  }

  return null;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { appPreferences, updateAppPreferences } = useShellModel();
  const persistedSettings = useMemo(
    () => getEffectiveSettings(appPreferences),
    [appPreferences],
  );
  const persistedSignature = useMemo(
    () => serializeSettings(persistedSettings),
    [persistedSettings],
  );
  const persistedSettingsRef = useRef(persistedSettings);
  const persistedSignatureRef = useRef(persistedSignature);
  const acknowledgedPersistedSignaturesRef = useRef<string[]>([]);
  const [draftState, setDraftState] = useState<SettingsDraftState | null>(null);

  persistedSettingsRef.current = persistedSettings;
  persistedSignatureRef.current = persistedSignature;

  const effectiveDraftState = reconcileSettingsDraftState(
    draftState,
    persistedSignature,
    acknowledgedPersistedSignaturesRef.current,
  );
  const settings = effectiveDraftState?.value ?? persistedSettings;
  const settingsSignature = serializeSettings(settings);
  const hasUnsavedChanges = settingsSignature !== persistedSignature;

  const rememberPersistedSignature = useCallback((signature: string) => {
    acknowledgedPersistedSignaturesRef.current = [
      ...acknowledgedPersistedSignaturesRef.current.filter(
        (entry) => entry !== signature,
      ),
      signature,
    ].slice(-12);
  }, []);

  const updateDraftState = useCallback(
    (updater: (current: Settings) => Settings) => {
      setDraftState((currentDraftState) => {
        const reconciledDraftState = reconcileSettingsDraftState(
          currentDraftState,
          persistedSignatureRef.current,
          acknowledgedPersistedSignaturesRef.current,
        );
        const currentPersistedSettings = persistedSettingsRef.current;
        const currentPersistedSignature = persistedSignatureRef.current;
        const currentSettings =
          reconciledDraftState?.value ?? currentPersistedSettings;
        const nextSettings = updater(currentSettings);

        if (serializeSettings(nextSettings) === currentPersistedSignature) {
          return null;
        }

        return {
          baseSignature:
            reconciledDraftState?.baseSignature ?? currentPersistedSignature,
          value: nextSettings,
        };
      });
    },
    [],
  );

  const updateSettings = useCallback(
    <K extends keyof Settings>(section: K, updates: Partial<Settings[K]>) => {
      updateDraftState((currentSettings) => ({
        ...currentSettings,
        [section]: { ...currentSettings[section], ...updates },
      }));
    },
    [updateDraftState],
  );

  const resetSection = useCallback(
    (section: SettingsSection) => {
      updateDraftState((currentSettings) => ({
        ...currentSettings,
        [section]: cloneSettings(DEFAULT_SETTINGS)[section],
      }));
    },
    [updateDraftState],
  );

  const resetAll = useCallback(() => {
    updateDraftState(() => cloneDefaultSettings());
  }, [updateDraftState]);

  const saveSettings = useCallback(async () => {
    const settingsToSave = settings;
    rememberPersistedSignature(serializeSettings(settingsToSave));

    try {
      await updateAppPreferences({
        settings: settingsToSave as unknown as Record<string, unknown>,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [rememberPersistedSignature, settings, updateAppPreferences]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const timeoutId = setTimeout(() => {
      rememberPersistedSignature(settingsSignature);
      void updateAppPreferences({
        settings: settings as unknown as Record<string, unknown>,
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    hasUnsavedChanges,
    rememberPersistedSignature,
    settings,
    settingsSignature,
    updateAppPreferences,
  ]);

  const value: SettingsContextValue = {
    settings,
    updateSettings,
    resetSection,
    resetAll,
    hasUnsavedChanges,
    saveSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
