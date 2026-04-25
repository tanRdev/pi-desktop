import type {
  AutocompleteContext,
  AutocompleteSuggestions,
  ModelSwitchRequest,
  OAuthProviderSnapshot,
  PiDiscoveryResult,
  SearchRequest,
  SearchResponse,
} from "@pi-desktop/shared";
import { Effect } from "effect";
import { fromUnknownError } from "../effect/errors";
import { runEffect } from "../effect/runtime";
import {
  getOAuthProvidersForAgentDir,
  loginWithOAuthForAgentDir,
  logoutOAuthForAgentDir,
} from "../pi-oauth-service";
import {
  discoverPiResources,
  getPiSlashSuggestions,
} from "../pi-resource-discovery";
import type { WorkspaceSearchService } from "../workspace-search-service";
import { switchModelForContext } from "./model-switch";
import type { SelectedThreadContext } from "./thread-context";

type SettingsManagerLike = {
  setDefaultProvider(providerId: string): void | Promise<void>;
  setDefaultModel(modelId: string): void | Promise<void>;
};

type AgentDesktopHost = {
  switchModel(request: ModelSwitchRequest): Promise<void>;
};

type OAuthPromptBridge = {
  openExternal(url: string): Promise<void>;
  requestInput(params: {
    providerId: string;
    message: string;
    authUrl?: string;
    verificationUri?: string;
    userCode?: string;
  }): Promise<string>;
};

type CreateAgentRuntimeHandlersInput = {
  getCurrentContext(): SelectedThreadContext | null;
  getCurrentHost(): AgentDesktopHost;
  getSelectionState(): { worktreeId: string | null };
  defaultAgentDirectory: string;
  getProcessCwd(): string;
  createSettingsManager(
    worktreePath: string,
    agentDirectory: string,
  ): SettingsManagerLike | Promise<SettingsManagerLike>;
  runtimeManager: {
    restartThreadRuntime(input: {
      threadId: string;
      worktreePath: string;
      command: string[];
    }): Promise<unknown>;
  };
  attachContext(context: SelectedThreadContext): Promise<unknown>;
  commitAttachment(attached: unknown): void | Promise<void>;
  workspaceSearchService: Pick<WorkspaceSearchService, "search">;
  oauthPromptBridge: OAuthPromptBridge;
  notifySessionChanged(): void;
};

export function createAgentRuntimeHandlers(
  input: CreateAgentRuntimeHandlersInput,
) {
  function resolveAgentDirectory(): string {
    return (
      input.getCurrentContext()?.runtimeAgentDirectory ??
      input.defaultAgentDirectory
    );
  }

  function resolveContextCwd(): string {
    return (
      input.getCurrentContext()?.worktreePath ??
      input.getSelectionState().worktreeId ??
      input.getProcessCwd()
    );
  }

  async function handleSwitchModel(request: ModelSwitchRequest): Promise<void> {
    const unsupportedModelSwitch =
      "Model switching is not supported by the active Pi runtime";

    const switchResult = await runEffect(
      Effect.tryPromise({
        try: () => input.getCurrentHost().switchModel(request),
        catch: (error) => fromUnknownError(error, "switchModel"),
      }).pipe(
        Effect.tap(() => Effect.sync(() => input.notifySessionChanged())),
        Effect.catchAll((error) => {
          if (
            error.cause instanceof Error &&
            error.cause.message !== unsupportedModelSwitch
          ) {
            return Effect.fail(error);
          }

          return Effect.succeed("fallback" as const);
        }),
      ),
    );

    if (switchResult === "fallback") {
      await switchModelForContext(request, {
        currentContext: input.getCurrentContext(),
        currentHost: input.getCurrentHost(),
        resolveAgentDirectory,
        createSettingsManager: input.createSettingsManager,
        runtimeManager: input.runtimeManager,
        attachContext: input.attachContext,
        commitAttachment: input.commitAttachment,
      });
    }
  }

  async function handleGetDiscovery(): Promise<PiDiscoveryResult> {
    return discoverPiResources(resolveAgentDirectory(), resolveContextCwd());
  }

  async function handleGetSlashSuggestions(
    context: AutocompleteContext,
  ): Promise<AutocompleteSuggestions> {
    return getPiSlashSuggestions({
      agentDir: resolveAgentDirectory(),
      cwd: resolveContextCwd(),
      context,
    });
  }

  async function handleSearchFiles(
    request: SearchRequest,
  ): Promise<SearchResponse> {
    return input.workspaceSearchService.search(request);
  }

  async function handleGetOAuthProviders(): Promise<OAuthProviderSnapshot[]> {
    return getOAuthProvidersForAgentDir(resolveAgentDirectory());
  }

  async function handleLoginWithOAuth(providerId: string): Promise<void> {
    await loginWithOAuthForAgentDir(
      resolveAgentDirectory(),
      providerId,
      input.oauthPromptBridge,
    );
    input.notifySessionChanged();
  }

  async function handleLogoutOAuth(providerId: string): Promise<void> {
    await logoutOAuthForAgentDir(resolveAgentDirectory(), providerId);
    input.notifySessionChanged();
  }

  return {
    handleSwitchModel,
    handleGetDiscovery,
    handleGetSlashSuggestions,
    handleSearchFiles,
    handleGetOAuthProviders,
    handleLoginWithOAuth,
    handleLogoutOAuth,
  };
}
