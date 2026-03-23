import { homedir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PiSdkAgentRuntime } from "../../../packages/agent-host/src/pi/pi-sdk-agent-runtime";

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

const modelRegistryCtor = vi.fn(
  (_authFilePath: string, _modelsFilePath: string) => ({
    getAvailable,
    refresh: vi.fn(),
  }),
);
const settingsCreate = vi.fn(() => ({
  getGlobalSettings: () => ({}),
  getProjectSettings: () => ({}),
  setDefaultProvider: vi.fn(),
  setDefaultModel: vi.fn(),
}));

describe("PiSdkAgentRuntime provider registry", () => {
  beforeEach(() => {
    modelRegistryCtor.mockClear();
    settingsCreate.mockClear();
    getAvailable.mockClear();
  });

  it("loads provider auth and models from the shared home agent directory", async () => {
    const runtime = new PiSdkAgentRuntime({
      cwd: "/tmp/project",
      agentDir: "/tmp/project/.pi/agent",
      createModelRegistry: modelRegistryCtor,
      createSettingsManager: settingsCreate,
    });

    const providers = await runtime.getProviders();

    expect(modelRegistryCtor).toHaveBeenCalledWith(
      `${homedir()}/.pi/agent/auth.json`,
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
