// Type declarations for the web app

declare global {
  interface Window {
    piDeskApi?: {
      shell: {
        getSnapshot(): Promise<{
          appName: string;
          appVersion: string;
          chromeVersion: string;
          platform: string;
          mode: string;
        }>;
      };
      agent: {
        getSnapshot(): Promise<{
          sessionId: string;
          status: string;
          messages: Array<{
            id: string;
            role: string;
            text: string;
            status: string;
            timestamp: number;
          }>;
          lastError: string | null;
        }>;
        prompt(text: string): Promise<void>;
        reset(): Promise<void>;
        subscribe(listener: (event: unknown) => void): () => void;
      };
    };
  }
}

export {};
