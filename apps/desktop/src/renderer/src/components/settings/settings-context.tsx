import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "./defaults";
import type { Settings, SettingsContextValue, SettingsSection } from "./types";

const SettingsContext = createContext<SettingsContextValue | null>(null);

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

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle any missing keys from updates
      return {
        ai: { ...DEFAULT_SETTINGS.ai, ...parsed.ai },
        interface: { ...DEFAULT_SETTINGS.interface, ...parsed.interface },
        editor: { ...DEFAULT_SETTINGS.editor, ...parsed.editor },
        terminal: { ...DEFAULT_SETTINGS.terminal, ...parsed.terminal },
        keybindings: { ...DEFAULT_SETTINGS.keybindings, ...parsed.keybindings },
        advanced: { ...DEFAULT_SETTINGS.advanced, ...parsed.advanced },
      };
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
  return { ...DEFAULT_SETTINGS };
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [originalSettings, setOriginalSettings] = useState<Settings>(() =>
    loadSettings(),
  );

  const hasUnsavedChanges =
    JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const updateSettings = useCallback(
    <K extends keyof Settings>(section: K, updates: Partial<Settings[K]>) => {
      setSettings((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...updates },
      }));
    },
    [],
  );

  const resetSection = useCallback((section: SettingsSection) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...DEFAULT_SETTINGS[section] },
    }));
  }, []);

  const resetAll = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setOriginalSettings({ ...settings });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [settings]);

  // Auto-save on settings change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setOriginalSettings({ ...settings });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [settings]);

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
