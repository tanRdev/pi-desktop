import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  AgentAutocompleteContextSchema,
  AgentLoginWithOAuthRequestSchema,
  AgentLogoutOAuthRequestSchema,
  AgentPromptRequestSchema,
  AgentSwitchModelRequestSchema,
  agentContracts,
  PiDesktopAgentEventSchema,
} from "./agent.js";

describe("agent request schemas", () => {
  it("accepts valid switchModel payloads", () => {
    expect(
      Schema.decodeUnknownSync(AgentSwitchModelRequestSchema)({
        providerId: "google",
        modelId: "gemini-2.5-pro",
      }),
    ).toEqual({
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });
  });

  it("rejects switchModel payloads with unknown keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(AgentSwitchModelRequestSchema)({
        providerId: "google",
        modelId: "gemini-2.5-pro",
        extra: true,
      }),
    ).toThrow(/unknown field "extra"/);
  });

  it("accepts valid OAuth login and logout payloads", () => {
    expect(
      Schema.decodeUnknownSync(AgentLoginWithOAuthRequestSchema)({
        providerId: "anthropic",
      }),
    ).toEqual({ providerId: "anthropic" });
    expect(
      Schema.decodeUnknownSync(AgentLogoutOAuthRequestSchema)({
        providerId: "anthropic",
      }),
    ).toEqual({ providerId: "anthropic" });
  });

  it("rejects OAuth payloads missing providerId", () => {
    expect(() =>
      Schema.decodeUnknownSync(AgentLoginWithOAuthRequestSchema)({}),
    ).toThrow();
  });

  it("accepts non-empty prompt payloads and rejects empty text", () => {
    expect(
      Schema.decodeUnknownSync(AgentPromptRequestSchema)({ text: "hello" }),
    ).toEqual({ text: "hello" });
    expect(() =>
      Schema.decodeUnknownSync(AgentPromptRequestSchema)({ text: "" }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(AgentPromptRequestSchema)({}),
    ).toThrow();
  });

  it("accepts slash suggestion context payloads", () => {
    expect(
      Schema.decodeUnknownSync(AgentAutocompleteContextSchema)({
        text: "/skill",
        cursorPosition: 6,
        query: "skill",
        trigger: "/",
      }),
    ).toEqual({
      text: "/skill",
      cursorPosition: 6,
      query: "skill",
      trigger: "/",
    });
  });

  it("rejects slash suggestion payloads with invalid trigger", () => {
    expect(() =>
      Schema.decodeUnknownSync(AgentAutocompleteContextSchema)({
        text: "/skill",
        cursorPosition: 6,
        query: "skill",
        trigger: "#",
      }),
    ).toThrow();
  });

  it("rejects slash suggestion payloads with non-finite cursorPosition", () => {
    expect(() =>
      Schema.decodeUnknownSync(AgentAutocompleteContextSchema)({
        text: "/skill",
        cursorPosition: Number.NaN,
        query: "skill",
      }),
    ).toThrow();
  });
});

describe("PiDesktopAgentEventSchema", () => {
  it("accepts lifecycle and message event payloads", () => {
    expect(
      Schema.decodeUnknownSync(PiDesktopAgentEventSchema)({
        type: "agent_start",
      }),
    ).toEqual({ type: "agent_start" });

    expect(
      Schema.decodeUnknownSync(PiDesktopAgentEventSchema)({
        type: "message_update",
        messageId: "msg-1",
        role: "assistant",
        text: "hello",
        delta: "lo",
        timestamp: 1,
      }),
    ).toEqual({
      type: "message_update",
      messageId: "msg-1",
      role: "assistant",
      text: "hello",
      delta: "lo",
      timestamp: 1,
    });
  });

  it("accepts tool execution and model_changed payloads", () => {
    expect(
      Schema.decodeUnknownSync(PiDesktopAgentEventSchema)({
        type: "tool_execution_end",
        toolCallId: "call-1",
        toolName: "read",
        result: { ok: true },
        isError: false,
      }),
    ).toEqual({
      type: "tool_execution_end",
      toolCallId: "call-1",
      toolName: "read",
      result: { ok: true },
      isError: false,
    });

    expect(
      Schema.decodeUnknownSync(PiDesktopAgentEventSchema)({
        type: "model_changed",
        providerId: "google",
        modelId: "gemini-2.5-pro",
      }),
    ).toEqual({
      type: "model_changed",
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });
  });

  it("rejects malformed agent event payloads", () => {
    expect(() =>
      Schema.decodeUnknownSync(PiDesktopAgentEventSchema)({
        type: "message_update",
        messageId: "msg-1",
        role: "assistant",
      }),
    ).toThrow();
  });
});

describe("agentContracts", () => {
  it("declares remaining agent invoke channels plus the event contract", () => {
    expect(agentContracts.getOAuthProviders.channel).toBe(
      "agent:getOAuthProviders",
    );
    expect(agentContracts.loginWithOAuth.channel).toBe("agent:loginWithOAuth");
    expect(agentContracts.logoutOAuth.channel).toBe("agent:logoutOAuth");
    expect(agentContracts.prompt.channel).toBe("agent:prompt");
    expect(agentContracts.cancelPrompt.channel).toBe("agent:cancelPrompt");
    expect(agentContracts.reset.channel).toBe("agent:reset");
    expect(agentContracts.switchModel.channel).toBe("agent:switchModel");
    expect(agentContracts.getDiscovery.channel).toBe("agent:getDiscovery");
    expect(agentContracts.getSlashSuggestions.channel).toBe(
      "agent:getSlashSuggestions",
    );
    expect(agentContracts.event.kind).toBe("event");
    expect(agentContracts.event.channel).toBe("agent:event");
  });
});
