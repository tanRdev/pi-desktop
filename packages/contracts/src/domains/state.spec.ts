import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { WorkspaceSessionSchema } from "../schemas.js";
import {
  AppPreferencesSchema,
  GetRepositoryPreferencesRequestSchema,
  GetWorkspaceSessionRequestSchema,
  ImportLegacyPreferencesRequestSchema,
  LegacyPreferencesImportSchema,
  RepositoryDisplayMetadataSchema,
  RepositoryPreferencesSchema,
  SaveWorkspaceSessionRequestSchema,
  stateContracts,
  UpdateAppPreferencesRequestSchema,
  UpdateRepositoryPreferencesRequestSchema,
} from "./state.js";

const sampleWorkspaceSession = {
  worktreeId: "wt-1",
  layout: {
    windows: [],
    nextZIndex: 1,
    focusedWindowId: null,
    snapGridSize: 24,
    zoom: 0.9,
    panX: 0,
    panY: 0,
  },
  sidebar: {
    activePanel: null,
    isCollapsed: false,
  },
  promptDrafts: {},
  search: {
    query: "",
    selectedPath: null,
  },
  files: {},
  notes: {},
  recoveryDrafts: {},
};

describe("state request schemas", () => {
  it("accepts valid getRepositoryPreferences payloads", () => {
    expect(
      Schema.decodeUnknownSync(GetRepositoryPreferencesRequestSchema)({
        repositoryId: "repo-1",
      }),
    ).toEqual({ repositoryId: "repo-1" });
  });

  it("rejects getRepositoryPreferences payloads with unknown keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(GetRepositoryPreferencesRequestSchema)({
        repositoryId: "repo-1",
        extra: true,
      }),
    ).toThrow();
  });

  it("accepts valid updateRepositoryPreferences payloads", () => {
    expect(
      Schema.decodeUnknownSync(UpdateRepositoryPreferencesRequestSchema)({
        repositoryId: "repo-1",
        updates: { customName: "My Repo" },
      }),
    ).toEqual({
      repositoryId: "repo-1",
      updates: { customName: "My Repo" },
    });
  });

  it("accepts valid getWorkspaceSession payloads", () => {
    expect(
      Schema.decodeUnknownSync(GetWorkspaceSessionRequestSchema)({
        worktreeId: "wt-1",
      }),
    ).toEqual({ worktreeId: "wt-1" });
  });

  it("accepts valid saveWorkspaceSession payloads", () => {
    expect(
      Schema.decodeUnknownSync(SaveWorkspaceSessionRequestSchema)({
        session: sampleWorkspaceSession,
      }),
    ).toEqual({ session: sampleWorkspaceSession });
  });

  it("accepts valid updateAppPreferences payloads", () => {
    expect(
      Schema.decodeUnknownSync(UpdateAppPreferencesRequestSchema)({
        updates: { leftSidebarWidth: 320 },
      }),
    ).toEqual({ updates: { leftSidebarWidth: 320 } });
  });

  it("accepts valid importLegacyPreferences payloads", () => {
    expect(
      Schema.decodeUnknownSync(ImportLegacyPreferencesRequestSchema)({
        importData: {
          leftSidebarWidth: 280,
          repositories: [{ repositoryId: "repo-1", customName: "Legacy" }],
        },
      }),
    ).toEqual({
      importData: {
        leftSidebarWidth: 280,
        repositories: [{ repositoryId: "repo-1", customName: "Legacy" }],
      },
    });
  });

  it("rejects importLegacyPreferences payloads with unknown importData keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(LegacyPreferencesImportSchema)({
        leftSidebarWidth: 280,
        unknown: true,
      }),
    ).toThrow();
  });
});

describe("state response schemas", () => {
  it("accepts repository and app preference snapshots", () => {
    expect(
      Schema.decodeUnknownSync(RepositoryPreferencesSchema)({
        repositoryId: "repo-1",
        customName: null,
        icon: null,
        accentColor: null,
      }),
    ).toEqual({
      repositoryId: "repo-1",
      customName: null,
      icon: null,
      accentColor: null,
    });

    expect(
      Schema.decodeUnknownSync(AppPreferencesSchema)({
        leftSidebarWidth: 300,
        ai: { provider: "anthropic", model: "claude" },
      }),
    ).toEqual({
      leftSidebarWidth: 300,
      ai: { provider: "anthropic", model: "claude" },
    });
  });

  it("accepts Workspace session snapshots", () => {
    expect(
      Schema.decodeUnknownSync(WorkspaceSessionSchema)(sampleWorkspaceSession),
    ).toEqual(sampleWorkspaceSession);
  });

  it("accepts partial repository display metadata updates", () => {
    expect(
      Schema.decodeUnknownSync(RepositoryDisplayMetadataSchema)({
        customName: "Renamed",
        icon: null,
        accentColor: "#ff0000",
      }),
    ).toEqual({
      customName: "Renamed",
      icon: null,
      accentColor: "#ff0000",
    });
  });
});

describe("stateContracts", () => {
  it("declares all state invoke channels", () => {
    expect(stateContracts.getRepositoryPreferences.channel).toBe(
      "state:getRepositoryPreferences",
    );
    expect(stateContracts.updateRepositoryPreferences.channel).toBe(
      "state:updateRepositoryPreferences",
    );
    expect(stateContracts.getWorkspaceSession.channel).toBe(
      "state:getWorkspaceSession",
    );
    expect(stateContracts.saveWorkspaceSession.channel).toBe(
      "state:saveWorkspaceSession",
    );
    expect(stateContracts.getAppPreferences.channel).toBe(
      "state:getAppPreferences",
    );
    expect(stateContracts.updateAppPreferences.channel).toBe(
      "state:updateAppPreferences",
    );
    expect(stateContracts.importLegacyPreferences.channel).toBe(
      "state:importLegacyPreferences",
    );
  });
});
