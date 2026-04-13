import { MockAgentRuntime } from "../mock/mock-agent-runtime.js";
import { PiCliRpcAgentRuntime } from "../pi/pi-cli-rpc-agent-runtime.js";
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
    }
  | {
      mode: "cli";
      cwd: string;
      agentDir: string;
    };

function assertNever(value: never): never {
  throw new Error(
    `Unsupported Pi Desktop agent runtime mode: ${String(value)}`,
  );
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
    case "cli":
      return new PiCliRpcAgentRuntime({
        cwd: options.cwd,
        agentDir: options.agentDir,
      });
    default:
      return assertNever(options);
  }
}

export type { CreateAgentRuntimeOptions };
