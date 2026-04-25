type OAuthPromptParams = {
  providerId: string;
  message: string;
  authUrl?: string;
  verificationUri?: string;
  userCode?: string;
};

type MainWindowLike = {
  webContents: {
    executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  };
};

type CreateOAuthPromptBridgeInput = {
  getMainWindow(): MainWindowLike | null;
  openExternal(url: string): Promise<void>;
};

export function createOAuthPromptBridge(input: CreateOAuthPromptBridgeInput): {
  openExternal(url: string): Promise<void>;
  requestInput(params: OAuthPromptParams): Promise<string>;
} {
  return {
    openExternal(url) {
      return input.openExternal(url);
    },
    async requestInput(params) {
      const mainWindow = input.getMainWindow();
      if (!mainWindow) {
        throw new Error("Main window is unavailable");
      }

      const detailLines = [
        params.message,
        params.authUrl ? `URL: ${params.authUrl}` : null,
        params.verificationUri ? `Verify at: ${params.verificationUri}` : null,
        params.userCode ? `Code: ${params.userCode}` : null,
      ].filter((value): value is string => value !== null);

      const response = await mainWindow.webContents.executeJavaScript(
        `window.prompt(${JSON.stringify(detailLines.join("\n\n"))}, "")`,
        true,
      );

      if (typeof response !== "string") {
        throw new Error(`OAuth input cancelled for ${params.providerId}`);
      }

      return response.trim();
    },
  };
}
