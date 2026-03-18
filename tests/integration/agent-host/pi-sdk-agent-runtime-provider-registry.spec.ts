import { homedir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAvailable = vi.fn(() => [
  {
    id: "gpt-5",
    name: "GPT-5",
    provider: "openai",
    reasoning: true,
    input: ["text"],
    contextWindow: 400000,
  },
]);

const authCreate = vi.fn((filePath: string) => ({ filePath }));
const modelRegistryCtor = vi.fn();
const settingsCreate = vi.fn(() => ({
  getGlobalSettings: () => ({}),
  getProjectSettings: () => ({}),
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  AuthStorage: {
    create: authCreate,
  },
  ModelRegistry: class ModelRegistry {
    constructor(...args: unknown[]) {
      modelRegistryCtor(...args);
    }

    getAvailable() {
      return getAvailable();
    }
  },
  SettingsManager: {
    create: settingsCreate,
  },
  createAgentSession: vi.fn(),
}));

describe("PiSdkAgentRuntime provider registry", () => {
  beforeEach(() => {
    authCreate.mockClear();
    modelRegistryCtor.mockClear();
    settingsCreate.mockClear();
    getAvailable.mockClear();
  });

  it("loads provider auth and models from the shared home agent directory", async () => {
    const { PiSdkAgentRuntime } = await import(
      "../../../packages/agent-host/src/pi/pi-sdk-agent-runtime"
    );

    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/project",
      agentDir: "/tmp/project/.pi/agent",
    });

    const providers = await runtime.getProviders();

    expect(authCreate).toHaveBeenCalledWith(`${homedir()}/.pi/agent/auth.json`);
    expect(modelRegistryCtor).toHaveBeenCalledWith(
      { filePath: `${homedir()}/.pi/agent/auth.json` },
      `${homedir()}/.pi/agent/models.json`,
    );
    expect(settingsCreate).toHaveBeenCalledWith(
      "/tmp/project",
      "/tmp/project/.pi/agent",
    );
    expect(providers).toEqual([
      {
        id: "openai",
        name: "openai",
        isConfigured: true,
        models: [
          {
            id: "gpt-5",
            name: "GPT-5",
            providerId: "openai",
            supportsThinking: true,
            supportsVision: false,
            contextWindow: 400000,
          },
        ],
      },
    ]);
  });
});
