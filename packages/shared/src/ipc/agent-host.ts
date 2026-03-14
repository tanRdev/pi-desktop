import type { AgentSnapshot } from "../models/agent.js";

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
      text: string;
      type: "prompt";
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
    };

export type AgentHostEnvelope =
  | {
      type: "event";
      event: import("../models/agent.js").PiDeskAgentEvent;
    }
  | {
      type: "response";
      response: AgentHostResponse;
    };
