import type {
  AgentSnapshot,
  ModelSwitchRequest,
  ProviderSnapshot,
  SettingsSnapshot,
} from "../models/agent.js";

export type AgentHostRequest =
  | {
      requestId: string;
      type: "bootstrap";
    }
  | {
      requestId: string;
      type: "reset";
    }
  | {
      requestId: string;
      type: "getSnapshot";
    }
  | {
      requestId: string;
      type: "getProviders";
    }
  | {
      requestId: string;
      type: "getSettings";
    }
  | {
      requestId: string;
      text: string;
      type: "prompt";
    }
  | {
      requestId: string;
      type: "cancelPrompt";
    }
  | {
      requestId: string;
      type: "switchModel";
      request: ModelSwitchRequest;
    };

export type AgentHostResponse =
  | {
      requestId: string;
      kind: "ack";
    }
  | {
      requestId: string;
      kind: "error";
      message: string;
    }
  | {
      requestId: string;
      kind: "snapshot";
      snapshot: AgentSnapshot;
    }
  | {
      requestId: string;
      kind: "providers";
      providers: ProviderSnapshot[];
    }
  | {
      requestId: string;
      kind: "settings";
      settings: SettingsSnapshot;
    };

export type AgentHostEnvelope =
  | {
      type: "event";
      event: import("../models/agent.js").PiDesktopAgentEvent;
    }
  | {
      type: "response";
      response: AgentHostResponse;
    };
