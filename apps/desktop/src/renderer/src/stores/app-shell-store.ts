import type {
  AppPreferences,
  ModelSwitchRequest,
  PiDeskApi,
  ProviderSnapshot,
  RepositoryDisplayMetadata,
  SettingsSnapshot,
} from "@pidesk/shared";
import { createShellModel, type ShellModelState } from "@pidesk/shell-model";
import { createStore } from "zustand/vanilla";
import {
  DEFAULT_SETTINGS,
  mergeSettingsWithDefaults,
  readLegacySettingsStorage,
} from "../components/settings/defaults";
import {
  clampLeftSidebarWidth,
  DEFAULT_LEFT_SIDEBAR_WIDTH,
  readLegacyLeftSidebarWidth,
} from "../lib/sidebar-preferences";

export interface AppShellStoreState {
  shellModel: ReturnType<typeof createShellModel>;
  shellState: ShellModelState;
  providerSnapshots: ProviderSnapshot[];
  settingsSnapshot: SettingsSnapshot;
  appPreferences: AppPreferences;
  isShellReady: boolean;
  isSwitchingModel: boolean;
  initialize(): Promise<void>;
  reload(): Promise<void>;
  sendPrompt(): Promise<void>;
  setDraft(draft: string): void;
  switchModel(request: ModelSwitchRequest): Promise<void>;
  updateAppPreferences(updates: Partial<AppPreferences>): Promise<void>;
  updateRepositoryPreferences(
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ): Promise<void>;
}

type EffectiveSettings = ReturnType<typeof mergeSettingsWithDefaults>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mergeSettingsState(
  base: EffectiveSettings,
  updates: unknown,
): EffectiveSettings {
  const parsed = isRecord(updates) ? updates : {};

  return {
    ai: { ...base.ai, ...(isRecord(parsed.ai) ? parsed.ai : {}) },
    interface: {
      ...base.interface,
      ...(isRecord(parsed.interface) ? parsed.interface : {}),
    },
    editor: {
      ...base.editor,
      ...(isRecord(parsed.editor) ? parsed.editor : {}),
    },
    terminal: {
      ...base.terminal,
      ...(isRecord(parsed.terminal) ? parsed.terminal : {}),
    },
    keybindings: {
      ...base.keybindings,
      ...(isRecord(parsed.keybindings) ? parsed.keybindings : {}),
    },
    advanced: {
      ...base.advanced,
      ...(isRecord(parsed.advanced) ? parsed.advanced : {}),
    },
  };
}

function normalizeAppPreferences(
  value: AppPreferences | undefined,
): AppPreferences {
  const normalizedSettings =
    value?.settings && typeof value.settings === "object"
      ? mergeSettingsWithDefaults(value.settings)
      : undefined;
  const sidebarWidthFromSettings = normalizedSettings?.interface.sidebarWidth;
  const resolvedLeftSidebarWidth =
    typeof value?.leftSidebarWidth === "number"
      ? clampLeftSidebarWidth(value.leftSidebarWidth)
      : typeof sidebarWidthFromSettings === "number"
        ? clampLeftSidebarWidth(sidebarWidthFromSettings)
        : DEFAULT_LEFT_SIDEBAR_WIDTH;

  return {
    ...value,
    leftSidebarWidth: resolvedLeftSidebarWidth,
    settings: {
      ...(normalizedSettings ?? DEFAULT_SETTINGS),
      interface: {
        ...(normalizedSettings?.interface ?? DEFAULT_SETTINGS.interface),
        sidebarWidth: resolvedLeftSidebarWidth,
      },
    },
  };
}

function getMigratedAppPreferences(
  preferences: AppPreferences | undefined,
): Partial<AppPreferences> {
  const migrated: Partial<AppPreferences> = {};
  const durableLeftSidebarWidth =
    typeof preferences?.leftSidebarWidth === "number"
      ? clampLeftSidebarWidth(preferences.leftSidebarWidth)
      : null;

  if (preferences?.settings === undefined) {
    const legacySettings = readLegacySettingsStorage();
    if (legacySettings) {
      migrated.settings = {
        ...legacySettings,
        interface: {
          ...legacySettings.interface,
          ...(durableLeftSidebarWidth === null
            ? {}
            : { sidebarWidth: durableLeftSidebarWidth }),
        },
      } as unknown as Record<string, unknown>;
    }
  }

  if (preferences?.leftSidebarWidth == null) {
    const legacySidebarWidth = readLegacyLeftSidebarWidth();
    if (legacySidebarWidth !== null) {
      migrated.leftSidebarWidth = legacySidebarWidth;
    }
  }

  return migrated;
}

export type AppShellStore = ReturnType<typeof createAppShellStore>;

let appShellStoreInstance: AppShellStore | null = null;

export function createAppShellStore(api: PiDeskApi) {
  const shellModel = createShellModel(api);
  let initializePromise: Promise<void> | null = null;

  const store = createStore<AppShellStoreState>()((set, get) => ({
    shellModel,
    shellState: shellModel.getState(),
    providerSnapshots: [],
    settingsSnapshot: {},
    appPreferences: {},
    isShellReady: false,
    isSwitchingModel: false,
    async initialize() {
      if (!initializePromise) {
        initializePromise = (async () => {
          await shellModel.load();
          const [providerSnapshots, settingsSnapshot, rawAppPreferences] =
            await Promise.all([
              api.agent.getProviders(),
              api.agent.getSettings(),
              api.state.getAppPreferences(),
            ]);

          const appPreferences = normalizeAppPreferences(rawAppPreferences);
          const migrated = getMigratedAppPreferences(rawAppPreferences);
          let finalPreferences = appPreferences;

          if (Object.keys(migrated).length > 0) {
            const persistedUpdates = normalizeAppPreferenceUpdates(
              migrated,
              appPreferences,
            );
            const response =
              await api.state.updateAppPreferences(persistedUpdates);
            finalPreferences = normalizeAppPreferences(
              mergeAppPreferences(appPreferences, persistedUpdates, response),
            );
          }

          set({
            providerSnapshots,
            settingsSnapshot,
            appPreferences: finalPreferences,
            shellState: shellModel.getState(),
            isShellReady: true,
          });
        })();
      }

      await initializePromise;
    },
    async reload() {
      await shellModel.load();
      const [providerSnapshots, settingsSnapshot] = await Promise.all([
        api.agent.getProviders(),
        api.agent.getSettings(),
      ]);
      set({
        shellState: shellModel.getState(),
        providerSnapshots,
        settingsSnapshot,
      });
    },
    async sendPrompt() {
      await shellModel.sendPrompt();
      set({ shellState: shellModel.getState() });
    },
    setDraft(draft) {
      shellModel.setDraft(draft);
      set({ shellState: shellModel.getState() });
    },
    async switchModel(request) {
      set({ isSwitchingModel: true });
      try {
        await api.agent.switchModel(request);
        await get().reload();
      } finally {
        set({ isSwitchingModel: false });
      }
    },
    async updateAppPreferences(updates) {
      const currentPreferences = get().appPreferences;
      const persistedUpdates = normalizeAppPreferenceUpdates(
        updates,
        currentPreferences,
      );
      const optimisticPreferences = normalizeAppPreferences(
        mergeAppPreferences(currentPreferences, persistedUpdates),
      );
      set({ appPreferences: optimisticPreferences });
      const response = await api.state.updateAppPreferences(persistedUpdates);
      const nextPreferences = normalizeAppPreferences(
        mergeAppPreferences(optimisticPreferences, persistedUpdates, response),
      );
      set({ appPreferences: nextPreferences });
    },
    async updateRepositoryPreferences(repositoryId, updates) {
      await api.state.updateRepositoryPreferences(repositoryId, updates);
      await get().reload();
    },
  }));

  shellModel.subscribe((shellState) => {
    store.setState({ shellState });
  });

  return store;
}

export function getAppShellStore(): AppShellStore {
  if (!appShellStoreInstance) {
    appShellStoreInstance = createAppShellStore(window.pidesk);
  }

  return appShellStoreInstance;
}

export function getEffectiveLeftSidebarWidth(
  preferences: AppPreferences,
): number {
  return (
    normalizeAppPreferences(preferences).leftSidebarWidth ??
    DEFAULT_LEFT_SIDEBAR_WIDTH
  );
}

export function getEffectiveSettings(preferences: AppPreferences) {
  return mergeSettingsWithDefaults(
    normalizeAppPreferences(preferences).settings,
  );
}

function mergeAppPreferences(
  base: AppPreferences,
  updates: Partial<AppPreferences>,
  response?: Partial<AppPreferences>,
): AppPreferences {
  return {
    ...base,
    ...updates,
    ...response,
    settings:
      response?.settings === undefined
        ? updates.settings === undefined
          ? base.settings
          : updates.settings
        : response.settings,
  };
}

function normalizeAppPreferenceUpdates(
  updates: Partial<AppPreferences>,
  currentPreferences: AppPreferences,
): Partial<AppPreferences> {
  const currentNormalizedPreferences =
    normalizeAppPreferences(currentPreferences);
  const mergedSettings =
    updates.settings === undefined
      ? getEffectiveSettings(currentNormalizedPreferences)
      : mergeSettingsState(
          getEffectiveSettings(currentNormalizedPreferences),
          updates.settings,
        );
  const resolvedLeftSidebarWidth =
    typeof updates.leftSidebarWidth === "number"
      ? clampLeftSidebarWidth(updates.leftSidebarWidth)
      : updates.settings !== undefined
        ? clampLeftSidebarWidth(mergedSettings.interface.sidebarWidth)
        : getEffectiveLeftSidebarWidth(currentNormalizedPreferences);

  return {
    leftSidebarWidth: resolvedLeftSidebarWidth,
    settings: {
      ...mergedSettings,
      interface: {
        ...mergedSettings.interface,
        sidebarWidth: resolvedLeftSidebarWidth,
      },
    } as Record<string, unknown>,
  };
}
