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

type StoredAiPreferences = {
  provider?: string;
  model?: string;
};

function readStoredAiPreferences(
  preferences: AppPreferences | undefined,
): StoredAiPreferences | null {
  if (!preferences?.settings || typeof preferences.settings !== "object") {
    return null;
  }

  const ai = (preferences.settings as Record<string, unknown>).ai;
  if (!ai || typeof ai !== "object") {
    return null;
  }

  const provider =
    typeof (ai as Record<string, unknown>).provider === "string"
      ? ((ai as Record<string, unknown>).provider as string)
      : undefined;
  const model =
    typeof (ai as Record<string, unknown>).model === "string"
      ? ((ai as Record<string, unknown>).model as string)
      : undefined;

  if (!provider && !model) {
    return null;
  }

  return { provider, model };
}

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
  cancelPrompt(): Promise<void>;
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
  const parsedAi = isRecord(parsed.ai) ? parsed.ai : {};
  const nextAi = {
    ...base.ai,
    ...(typeof parsedAi.provider === "string" && parsedAi.provider.length > 0
      ? { provider: parsedAi.provider }
      : {}),
    ...(typeof parsedAi.model === "string" && parsedAi.model.length > 0
      ? { model: parsedAi.model }
      : {}),
  };

  return {
    ai: nextAi,
    interface: {
      ...base.interface,
      ...(isRecord(parsed.interface) ? parsed.interface : {}),
    },
  };
}

function normalizeAppPreferences(
  value: AppPreferences | undefined,
): AppPreferences {
  const storedAiPreferences = readStoredAiPreferences(value);
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
      ai: {
        ...((normalizedSettings?.ai ??
          DEFAULT_SETTINGS.ai) as EffectiveSettings["ai"]),
        ...(storedAiPreferences?.provider
          ? { provider: storedAiPreferences.provider }
          : {}),
        ...(storedAiPreferences?.model
          ? { model: storedAiPreferences.model }
          : {}),
      },
      interface: {
        ...(normalizedSettings?.interface ?? DEFAULT_SETTINGS.interface),
        sidebarWidth: resolvedLeftSidebarWidth,
      },
    },
  };
}

function getSelectedModelValue(settings: SettingsSnapshot): {
  providerId: string | null;
  modelId: string | null;
} {
  return {
    providerId: settings.currentProviderId ?? settings.defaultProvider ?? null,
    modelId: settings.currentModelId ?? settings.defaultModel ?? null,
  };
}

function buildAiPreferenceUpdate(
  preferences: AppPreferences,
  request: ModelSwitchRequest,
): Partial<AppPreferences> {
  const normalized = normalizeAppPreferences(preferences);
  const effectiveSettings = getEffectiveSettings(normalized);

  return {
    settings: {
      ...effectiveSettings,
      ai: {
        ...effectiveSettings.ai,
        provider: request.providerId,
        model: request.modelId,
      },
    } as Record<string, unknown>,
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
          let [providerSnapshots, settingsSnapshot, rawAppPreferences] =
            await Promise.all([
              api.agent.getProviders(),
              api.agent.getSettings(),
              api.state.getAppPreferences(),
            ]);
          const storedAiPreferences =
            readStoredAiPreferences(rawAppPreferences);

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

          const selectedModel = getSelectedModelValue(settingsSnapshot);
          if (
            storedAiPreferences?.provider &&
            storedAiPreferences?.model &&
            (storedAiPreferences.provider !== selectedModel.providerId ||
              storedAiPreferences.model !== selectedModel.modelId)
          ) {
            await api.agent.switchModel({
              providerId: storedAiPreferences.provider,
              modelId: storedAiPreferences.model,
            });
            settingsSnapshot = await api.agent.getSettings();
            await shellModel.load();
            providerSnapshots = await api.agent.getProviders();
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
    async cancelPrompt() {
      await shellModel.cancelPrompt();
      set({ shellState: shellModel.getState() });
    },
    setDraft(draft) {
      shellModel.setDraft(draft);
      set({ shellState: shellModel.getState() });
    },
    async switchModel(request) {
      const currentPreferences = get().appPreferences;
      const previousSettingsSnapshot = get().settingsSnapshot;
      const optimisticPreferences = normalizeAppPreferences(
        mergeAppPreferences(
          currentPreferences,
          normalizeAppPreferenceUpdates(
            buildAiPreferenceUpdate(currentPreferences, request),
            currentPreferences,
          ),
        ),
      );
      set({ isSwitchingModel: true });
      set({
        appPreferences: optimisticPreferences,
        settingsSnapshot: {
          ...get().settingsSnapshot,
          currentProviderId: request.providerId,
          currentModelId: request.modelId,
          defaultProvider: request.providerId,
          defaultModel: request.modelId,
        },
      });
      try {
        await api.agent.switchModel(request);
        const persistedUpdates = normalizeAppPreferenceUpdates(
          buildAiPreferenceUpdate(currentPreferences, request),
          currentPreferences,
        );
        const response = await api.state.updateAppPreferences(persistedUpdates);
        set({
          appPreferences: normalizeAppPreferences(
            mergeAppPreferences(
              optimisticPreferences,
              persistedUpdates,
              response,
            ),
          ),
        });
        await get().reload();
      } catch (error) {
        set({
          appPreferences: currentPreferences,
          settingsSnapshot: previousSettingsSnapshot,
        });
        throw error;
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
