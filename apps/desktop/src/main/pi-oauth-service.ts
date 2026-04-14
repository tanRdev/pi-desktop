import { AuthStorage } from "@mariozechner/pi-coding-agent";
import type { OAuthProviderSnapshot } from "@pi-desktop/shared";

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

function createAuthStorage(agentDir: string): AuthStorage {
  return AuthStorage.create(`${agentDir}/auth.json`);
}

export async function getOAuthProvidersForAgentDir(
  agentDir: string,
): Promise<OAuthProviderSnapshot[]> {
  const authStorage = createAuthStorage(agentDir);

  return authStorage.getOAuthProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    usesCallbackServer: provider.usesCallbackServer,
    isAuthenticated: authStorage.has(provider.id),
  }));
}

export async function loginWithOAuthForAgentDir(
  agentDir: string,
  providerId: string,
  bridge: OAuthPromptBridge,
): Promise<void> {
  const authStorage = createAuthStorage(agentDir);
  let latestAuthInfo: { url: string; instructions?: string } | null = null;

  await authStorage.login(providerId, {
    onAuth: ({ url, instructions }) => {
      latestAuthInfo = { url, instructions };
      void bridge.openExternal(url);
    },
    onPrompt: ({ message }) =>
      bridge.requestInput({
        providerId,
        message,
        authUrl: latestAuthInfo?.url,
      }),
    onManualCodeInput: () =>
      bridge.requestInput({
        providerId,
        message:
          latestAuthInfo?.instructions ??
          "Complete login in browser, then paste requested code or redirected URL here.",
        authUrl: latestAuthInfo?.url,
      }),
  });
}

export async function logoutOAuthForAgentDir(
  agentDir: string,
  providerId: string,
): Promise<void> {
  const authStorage = createAuthStorage(agentDir);
  authStorage.logout(providerId);
}
