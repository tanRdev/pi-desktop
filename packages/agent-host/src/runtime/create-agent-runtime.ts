import { MockAgentRuntime } from "../mock/mock-agent-runtime.js";
import {
  PiSdkAgentRuntime,
  type PiSdkAgentRuntimeOptions,
} from "../pi/pi-sdk-agent-runtime.js";

type CreateSdkAgentSession = NonNullable<
  PiSdkAgentRuntimeOptions["createAgentSession"]
>;

type CreateAgentRuntimeOptions =
  | {
      mode: "mock";
      cwd: string;
      agentDir?: string;
    }
  | {
      mode: "sdk";
      cwd: string;
      agentDir?: string;
      createAgentSession?: CreateSdkAgentSession;
    };

function assertNever(value: never): never {
  throw new Error(`Unsupported PiDesk agent runtime mode: ${String(value)}`);
}

export function createAgentRuntime(options: CreateAgentRuntimeOptions) {
  switch (options.mode) {
    case "mock":
      return new MockAgentRuntime();
    case "sdk":
      return new PiSdkAgentRuntime({
        cwd: options.cwd,
        agentDir: options.agentDir,
        createAgentSession: options.createAgentSession,
      });
    default:
      return assertNever(options);
  }
}

export type { CreateAgentRuntimeOptions };
