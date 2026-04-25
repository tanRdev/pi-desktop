import type {
  AppPreferences,
  ModelSwitchRequest,
  PiDesktopApi,
  ProviderSnapshot,
  RepositoryDisplayMetadata,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import {
  createShellModel,
  type ShellModelState,
} from "@pi-desktop/shell-model";
import { createStore } from "zustand/vanilla";
import {
  buildAiPreferenceUpdate,
  getMigratedAppPreferences,
  getSelectedModelValue,
  getStoredAiPreferences,
  mergeAppPreferences,
  normalizeAppPreferences,
  normalizeAppPreferenceUpdates,
} from "./app-shell-store-preferences";

export interface AppShellStoreState {
  shellModel: ReturnType<typeof createShellModel>;
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

export type AppShellStore = ReturnType<typeof createAppShellStore>;

let appShellStoreInstance: AppShellStore | null = null;

export function createAppShellStore(api: PiDesktopApi) {
  const shellModel = createShellModel(api);
  let initializePromise: Promise<void> | null = null;
  let runtimeRefreshVersion = 0;
  let lastRuntimeContextKey = createRuntimeContextKey(shellModel.getState());
  let pendingRuntimeMetadataRefresh = false;

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
    providerSnapshots: [],
    settingsSnapshot: {},
    appPreferences: {},
    isShellReady: false,
    isSwitchingModel: false,
    async initialize() {
      if (!initializePromise) {
        const pending = (async () => {
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
            isShellReady: true,
          });
        })();

        // Cache the in-flight promise so concurrent callers share it,
        // but reset the cache on failure so a later `initialize()` call
        // can retry. Leaving the rejected promise in place would cause
        // every subsequent `await initialize()` to re-throw the same
        // error and deadlock the app-shell startup sequence.
        const wrapped: Promise<void> = pending.catch((error) => {
          if (initializePromise === wrapped) {
            initializePromise = null;
          }
          throw error;
        });
        initializePromise = wrapped;
      }

      await initializePromise;
    },
    async reload() {
      await shellModel.load();
      await refreshRuntimeMetadata();
    },
    async sendPrompt() {
      await shellModel.sendPrompt();
    },
    async cancelPrompt() {
      await shellModel.cancelPrompt();
    },
    setDraft(draft) {
      shellModel.setDraft(draft);
    },
    async switchModel(request) {
      if (
        get().shellModel.getState().agent.status === "starting" ||
        get().shellModel.getState().agent.status === "streaming"
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

  let lastShellState = shellModel.getState();
  shellModel.subscribe((shellState) => {
    const previousShellState = lastShellState;
    const previousSelection = previousShellState.shell.catalog.selection;
    const nextSelection = shellState.shell.catalog.selection;
    const nextRuntimeContextKey = createRuntimeContextKey(shellState);
    const runtimeSelectionChanged =
      nextRuntimeContextKey !== lastRuntimeContextKey;
    const selectedThreadChanged =
      previousSelection.threadId !== nextSelection.threadId;
    const hasSelectedThread =
      shellState.shell.catalog.selection.threadId !== null;
    const isSelectedThreadLoading =
      hasSelectedThread && shellState.agent.status === "starting";
    const shouldRefreshRuntimeMetadata =
      store.getState().isShellReady &&
      ((runtimeSelectionChanged && !isSelectedThreadLoading) ||
        (pendingRuntimeMetadataRefresh && !isSelectedThreadLoading));

    if (
      store.getState().isShellReady &&
      (runtimeSelectionChanged || selectedThreadChanged)
    ) {
      pendingRuntimeMetadataRefresh = isSelectedThreadLoading;
    }

    lastRuntimeContextKey = nextRuntimeContextKey;
    lastShellState = shellState;

    if (shouldRefreshRuntimeMetadata) {
      pendingRuntimeMetadataRefresh = false;
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

export { getEffectiveLeftSidebarWidth } from "./app-shell-store-preferences";
