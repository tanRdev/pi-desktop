import { randomUUID } from "node:crypto";
import {
  IPC_CHANNELS,
  type OAuthPromptRequest,
  type OAuthPromptResponse,
} from "@pi-desktop/shared";

type OAuthPromptParams = {
  providerId: string;
  message: string;
  authUrl?: string;
  verificationUri?: string;
  userCode?: string;
};

type MainWindowLike = {
  webContents: {
    send(channel: string, ...args: unknown[]): void;
  };
};

type CreateOAuthPromptBridgeInput = {
  getMainWindow(): MainWindowLike | null;
  openExternal(url: string): Promise<void>;
};

type PendingPrompt = {
  providerId: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

export function createOAuthPromptBridge(input: CreateOAuthPromptBridgeInput): {
  openExternal(url: string): Promise<void>;
  requestInput(params: OAuthPromptParams): Promise<string>;
  respond(response: OAuthPromptResponse): void;
} {
  const pending = new Map<string, PendingPrompt>();

  return {
    openExternal(url) {
      return input.openExternal(url);
    },
    async requestInput(params) {
      const mainWindow = input.getMainWindow();
      if (!mainWindow) {
        throw new Error("Main window is unavailable");
      }

      const requestId = randomUUID();
      const payload: OAuthPromptRequest = {
        requestId,
        providerId: params.providerId,
        message: params.message,
        ...(params.authUrl ? { authUrl: params.authUrl } : {}),
        ...(params.verificationUri
          ? { verificationUri: params.verificationUri }
          : {}),
        ...(params.userCode ? { userCode: params.userCode } : {}),
      };

      const responsePromise = new Promise<string>((resolve, reject) => {
        pending.set(requestId, {
          providerId: params.providerId,
          resolve,
          reject,
        });
      });

      mainWindow.webContents.send(IPC_CHANNELS.agent.oauthPrompt, payload);

      return responsePromise;
    },
    respond(response) {
      const entry = pending.get(response.requestId);
      if (!entry) {
        return;
      }

      pending.delete(response.requestId);

      if (response.value === null) {
        entry.reject(
          new Error(`OAuth input cancelled for ${entry.providerId}`),
        );
        return;
      }

      entry.resolve(response.value.trim());
    },
  };
}
