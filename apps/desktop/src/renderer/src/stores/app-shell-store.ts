import type {
  AiPreferences,
  AppPreferences,
  ModelSwitchRequest,
  PiDesktopApi,
  ProviderSnapshot,
  RepositoryDisplayMetadata,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import { createShellModel, type ShellModelState } from "@pi-desktop/shell-model";
import { createStore } from "zustand/vanilla";
import {
  DEFAULT_AI_PREFERENCES,
  normalizeAiPreferences,
  readLegacySettings,
  readLegacySettingsStorage,
} from "../lib/app-preferences";
import {
  clampLeftSidebarWidth,
  DEFAULT_LEFT_SIDEBAR_WIDTH,
  readLegacyLeftSidebarWidth,
} from "../lib/sidebar-preferences";

type StoredAiPreferences = {
  provider: string;
  model: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readLegacySettingsFromAppPreferences(
  preferences: AppPreferences | undefined,
) {
  if (!isRecord(preferences) || !("settings" in preferences)) {
    return null;
  }

  return readLegacySettings(preferences.settings);
}

function getStoredAiPreferences(
  preferences: AppPreferences | undefined,
): StoredAiPreferences {
  if (preferences?.ai !== undefined && preferences.ai !== null) {
    return normalizeAiPreferences(preferences.ai);
  }

  return (
    readLegacySettingsFromAppPreferences(preferences)?.ai ??
    DEFAULT_AI_PREFERENCES
  );
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

function createRuntimeContextKey(shellState: ShellModelState): string {
  const selection = shellState.shell.catalog.selection;

  return [selection.repositoryId ?? "", selection.worktreeId ?? ""].join("::");
}

function normalizeAppPreferences(
  value: AppPreferences | undefined,
): AppPreferences {
  const legacySettings = readLegacySettingsFromAppPreferences(value);
  const resolvedLeftSidebarWidth =
    typeof value?.leftSidebarWidth === "number"
      ? clampLeftSidebarWidth(value.leftSidebarWidth)
      : typeof legacySettings?.leftSidebarWidth === "number"
        ? clampLeftSidebarWidth(legacySettings.leftSidebarWidth)
        : DEFAULT_LEFT_SIDEBAR_WIDTH;

  return {
    leftSidebarWidth: resolvedLeftSidebarWidth,
    ai: getStoredAiPreferences(value),
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

  return {
    ai: {
      ...normalizeAiPreferences(normalized.ai),
      provider: request.providerId,
      model: request.modelId,
    },
  };
}

function getMigratedAppPreferences(
  preferences: AppPreferences | undefined,
): Partial<AppPreferences> {
  const migrated: Partial<AppPreferences> = {};
  const legacySettings =
    readLegacySettingsFromAppPreferences(preferences) ??
    readLegacySettingsStorage();

  if (preferences?.ai == null && legacySettings) {
    migrated.ai = legacySettings.ai;
  }

  if (preferences?.leftSidebarWidth == null) {
    const legacySidebarWidth = readLegacyLeftSidebarWidth();
    if (legacySidebarWidth !== null) {
      migrated.leftSidebarWidth = legacySidebarWidth;
    } else if (typeof legacySettings?.leftSidebarWidth === "number") {
      migrated.leftSidebarWidth = legacySettings.leftSidebarWidth;
    }
  }

  return migrated;
}

export type AppShellStore = ReturnType<typeof createAppShellStore>;

let appShellStoreInstance: AppShellStore | null = null;

export function createAppShellStore(api: PiDesktopApi) {
  const shellModel = createShellModel(api);
  let initializePromise: Promise<void> | null = null;
  let runtimeRefreshVersion = 0;
  let lastRuntimeContextKey = createRuntimeContextKey(shellModel.getState());

  async function refreshRuntimeMetadata(): Promise<void> {
    const nextVersion = runtimeRefreshVersion + 1;
    runtimeRefreshVersion = nextVersion;

    const [providerSnapshots, settingsSnapshot] = await Promise.all([
      api.agent.getProviders(),
      api.agent.getSettings(),
    ]);

    if (runtimeRefreshVersion !== nextVersion) {
      return;
    }

    store.setState({
      providerSnapshots,
      settingsSnapshot,
    });
  }

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
          const storedAiPreferences = getStoredAiPreferences(rawAppPreferences);

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
            storedAiPreferences.provider &&
            storedAiPreferences.model &&
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
      await refreshRuntimeMetadata();
      set({
        shellState: shellModel.getState(),
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
      if (
        get().shellState.agent.status === "starting" ||
        get().shellState.agent.status === "streaming"
      ) {
        throw new Error("Cannot switch models while Pi is responding");
      }

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
    const nextRuntimeContextKey = createRuntimeContextKey(shellState);
    const shouldRefreshRuntimeMetadata =
      store.getState().isShellReady &&
      nextRuntimeContextKey !== lastRuntimeContextKey;

    lastRuntimeContextKey = nextRuntimeContextKey;
    store.setState({ shellState });

    if (shouldRefreshRuntimeMetadata) {
      void refreshRuntimeMetadata();
    }
  });

  return store;
}

export function getAppShellStore(): AppShellStore {
  if (!appShellStoreInstance) {
    appShellStoreInstance = createAppShellStore(window.piDesktop);
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

function mergeAppPreferences(
  base: AppPreferences,
  updates: Partial<AppPreferences>,
  response?: Partial<AppPreferences>,
): AppPreferences {
  const leftSidebarWidth =
    response?.leftSidebarWidth === undefined
      ? updates.leftSidebarWidth === undefined
        ? base.leftSidebarWidth
        : updates.leftSidebarWidth
      : response.leftSidebarWidth;
  const ai =
    response?.ai === undefined
      ? updates.ai === undefined
        ? base.ai
        : updates.ai
      : response.ai;

  return {
    ...(leftSidebarWidth === undefined ? {} : { leftSidebarWidth }),
    ...(ai === undefined ? {} : { ai }),
  };
}

function mergeAiPreferenceUpdates(
  currentAi: AiPreferences | null | undefined,
  nextAi: AiPreferences | null | undefined,
): StoredAiPreferences {
  if (nextAi === null) {
    return DEFAULT_AI_PREFERENCES;
  }

  if (nextAi === undefined) {
    return normalizeAiPreferences(currentAi);
  }

  const current = normalizeAiPreferences(currentAi);
  const next = normalizeAiPreferences(nextAi);

  return {
    provider: next.provider.length > 0 ? next.provider : current.provider,
    model: next.model.length > 0 ? next.model : current.model,
  };
}

function normalizeAppPreferenceUpdates(
  updates: Partial<AppPreferences>,
  currentPreferences: AppPreferences,
): Partial<AppPreferences> {
  const currentNormalizedPreferences =
    normalizeAppPreferences(currentPreferences);
  const resolvedLeftSidebarWidth =
    typeof updates.leftSidebarWidth === "number"
      ? clampLeftSidebarWidth(updates.leftSidebarWidth)
      : getEffectiveLeftSidebarWidth(currentNormalizedPreferences);

  return {
    leftSidebarWidth: resolvedLeftSidebarWidth,
    ai: mergeAiPreferenceUpdates(currentNormalizedPreferences.ai, updates.ai),
  };
}
