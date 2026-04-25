import type { AppPreferences } from "@pi-desktop/shared";
import {
  createEmptyWorkspaceSession,
  IPC_CHANNELS,
  type LegacyPreferencesImport,
  type RepositoryPreferences,
} from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import { createStateApi, type PreloadInvoke, type StateApi } from "./state-api";

describe("createStateApi", () => {
  it("invokes state persistence channels", async () => {
    const repositoryPreferences: RepositoryPreferences = {
      repositoryId: "/tmp/work/repo-one",
      customName: "Repo One",
      icon: "rocket",
      accentColor: "#2255aa",
    };
    const workspaceSession = createEmptyWorkspaceSession(
      "/tmp/work/repo-one/feature",
    );
    const appPreferences: AppPreferences = {
      leftSidebarWidth: 240,
    };
    const legacyPreferences: LegacyPreferencesImport = {
      leftSidebarWidth: 240,
      repositories: [
        {
          repositoryId: "/tmp/work/repo-one",
          customName: "Repo One",
        },
      ],
    };
    const invokeCalls: Array<[string, unknown?]> = [];
    const invoke: PreloadInvoke = async <TReturn>(
      channel: string,
      payload?: unknown,
    ) => {
      invokeCalls.push([channel, payload]);

      if (channel === IPC_CHANNELS.state.getRepositoryPreferences) {
        return repositoryPreferences as TReturn;
      }

      if (channel === IPC_CHANNELS.state.updateRepositoryPreferences) {
        return repositoryPreferences as TReturn;
      }

      if (channel === IPC_CHANNELS.state.getWorkspaceSession) {
        return workspaceSession as TReturn;
      }

      if (channel === IPC_CHANNELS.state.saveWorkspaceSession) {
        return workspaceSession as TReturn;
      }

      if (channel === IPC_CHANNELS.state.getAppPreferences) {
        return appPreferences as TReturn;
      }

      if (channel === IPC_CHANNELS.state.updateAppPreferences) {
        return appPreferences as TReturn;
      }

      if (channel === IPC_CHANNELS.state.importLegacyPreferences) {
        return {
          repositoryPreferences: [repositoryPreferences],
          appPreferences,
        } as TReturn;
      }

      return undefined as TReturn;
    };

    const state: StateApi = createStateApi({ invoke });

    await expect(
      state.getRepositoryPreferences("/tmp/work/repo-one"),
    ).resolves.toEqual(repositoryPreferences);
    await expect(
      state.updateRepositoryPreferences("/tmp/work/repo-one", {
        customName: "Repo One",
        icon: "rocket",
        accentColor: "#2255aa",
      }),
    ).resolves.toEqual(repositoryPreferences);
    await expect(
      state.getWorkspaceSession("/tmp/work/repo-one/feature"),
    ).resolves.toEqual(workspaceSession);
    await expect(state.saveWorkspaceSession(workspaceSession)).resolves.toEqual(
      workspaceSession,
    );
    await expect(state.getAppPreferences()).resolves.toEqual(appPreferences);
    await expect(
      state.updateAppPreferences({
        leftSidebarWidth: 240,
      }),
    ).resolves.toEqual(appPreferences);
    await expect(
      state.importLegacyPreferences(legacyPreferences),
    ).resolves.toEqual({
      repositoryPreferences: [repositoryPreferences],
      appPreferences,
    });

    expect(invokeCalls).toEqual([
      [
        IPC_CHANNELS.state.getRepositoryPreferences,
        { repositoryId: "/tmp/work/repo-one" },
      ],
      [
        IPC_CHANNELS.state.updateRepositoryPreferences,
        {
          repositoryId: "/tmp/work/repo-one",
          updates: {
            customName: "Repo One",
            icon: "rocket",
            accentColor: "#2255aa",
          },
        },
      ],
      [
        IPC_CHANNELS.state.getWorkspaceSession,
        { worktreeId: "/tmp/work/repo-one/feature" },
      ],
      [IPC_CHANNELS.state.saveWorkspaceSession, { session: workspaceSession }],
      [IPC_CHANNELS.state.getAppPreferences, undefined],
      [
        IPC_CHANNELS.state.updateAppPreferences,
        {
          updates: {
            leftSidebarWidth: 240,
          },
        },
      ],
      [
        IPC_CHANNELS.state.importLegacyPreferences,
        {
          importData: legacyPreferences,
        },
      ],
    ]);
  });
});
