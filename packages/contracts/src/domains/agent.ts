import type {
  AutocompleteContext,
  AutocompleteSuggestions,
  ModelSwitchRequest,
  ModelSwitchResult,
  OAuthPromptRequest,
  OAuthPromptResponse,
  OAuthProviderSnapshot,
  PiDesktopAgentEvent,
  PiDiscoveryResult,
} from "@pi-desktop/shared";
import { Schema } from "effect";
import { IPC_CHANNELS } from "../channels.js";

import {
  createIpcContract,
  createIpcEventContract,
  type NoPayloadIpcContract,
} from "../contract-runtime.js";
import { createStrictObjectSchema } from "./helpers.js";
import {
  finiteNumberSchema,
  ipcStringSchema,
  mutableArray,
} from "./schema-primitives.js";

const AgentMessageRoleSchema = Schema.Literal(
  "assistant",
  "system",
  "tool",
  "user",
);

const SWITCH_MODEL_KEYS = new Set(["providerId", "modelId"]);
const OAUTH_PROVIDER_ID_KEYS = new Set(["providerId"]);
const OAUTH_PROMPT_REQUEST_KEYS = new Set([
  "requestId",
  "providerId",
  "message",
  "authUrl",
  "verificationUri",
  "userCode",
]);
const OAUTH_PROMPT_RESPONSE_KEYS = new Set(["requestId", "value"]);
const PROMPT_KEYS = new Set(["text"]);
const AUTOCOMPLETE_CONTEXT_KEYS = new Set([
  "text",
  "cursorPosition",
  "query",
  "trigger",
]);

export const AgentSwitchModelRequestSchema =
  createStrictObjectSchema<ModelSwitchRequest>(SWITCH_MODEL_KEYS, {
    providerId: ipcStringSchema(),
    modelId: ipcStringSchema(),
  });

const MODEL_SWITCH_RESULT_KEYS = new Set(["mode"]);

export const ModelSwitchResultSchema =
  createStrictObjectSchema<ModelSwitchResult>(MODEL_SWITCH_RESULT_KEYS, {
    mode: Schema.Literal("live", "restart"),
  });

export const AgentLoginWithOAuthRequestSchema = createStrictObjectSchema<{
  readonly providerId: string;
}>(OAUTH_PROVIDER_ID_KEYS, {
  providerId: ipcStringSchema(),
});

export const AgentLogoutOAuthRequestSchema = createStrictObjectSchema<{
  readonly providerId: string;
}>(OAUTH_PROVIDER_ID_KEYS, {
  providerId: ipcStringSchema(),
});

export const AgentPromptRequestSchema = createStrictObjectSchema<{
  readonly text: string;
}>(PROMPT_KEYS, {
  text: ipcStringSchema().pipe(
    Schema.filter((value) => value.length > 0, {
      message: () => "text must not be empty",
    }),
  ),
});

export const AgentAutocompleteContextSchema =
  createStrictObjectSchema<AutocompleteContext>(AUTOCOMPLETE_CONTEXT_KEYS, {
    text: ipcStringSchema(),
    cursorPosition: finiteNumberSchema(),
    query: ipcStringSchema(),
    trigger: Schema.optional(Schema.Literal("/", "@")),
  });

export const OAuthProviderSnapshotSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  usesCallbackServer: Schema.optional(Schema.Boolean),
  isAuthenticated: Schema.optional(Schema.Boolean),
}) satisfies Schema.Schema<OAuthProviderSnapshot>;

export const OAuthProviderSnapshotArraySchema = mutableArray(
  OAuthProviderSnapshotSchema,
);

export const OAuthPromptRequestSchema =
  createStrictObjectSchema<OAuthPromptRequest>(OAUTH_PROMPT_REQUEST_KEYS, {
    requestId: ipcStringSchema(),
    providerId: ipcStringSchema(),
    message: ipcStringSchema(),
    authUrl: Schema.optional(ipcStringSchema()),
    verificationUri: Schema.optional(ipcStringSchema()),
    userCode: Schema.optional(ipcStringSchema()),
  });

export const OAuthPromptResponseSchema =
  createStrictObjectSchema<OAuthPromptResponse>(OAUTH_PROMPT_RESPONSE_KEYS, {
    requestId: ipcStringSchema(),
    value: Schema.NullOr(ipcStringSchema()),
  });

const PiSkillInfoSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
});

const PiCommandInfoSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
});

export const PiDiscoveryResultSchema = Schema.Struct({
  isInstalled: Schema.Boolean,
  version: Schema.optional(Schema.String),
  globalAgentDir: Schema.optional(Schema.String),
  skills: mutableArray(PiSkillInfoSchema),
  commands: mutableArray(PiCommandInfoSchema),
}) satisfies Schema.Schema<PiDiscoveryResult>;

const SlashSuggestionSchema = Schema.Struct({
  kind: Schema.Literal("skill", "command", "prompt", "model"),
  name: Schema.String,
  slash: Schema.String,
  description: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
});

const MentionSuggestionSchema = Schema.Struct({
  kind: Schema.Literal("file", "terminal", "thread"),
  name: Schema.String,
  id: Schema.String,
  context: Schema.optional(Schema.String),
  linkColor: Schema.optional(Schema.String),
});

export const AutocompleteSuggestionsSchema = Schema.Struct({
  kind: Schema.Literal("slash", "mention"),
  suggestions: mutableArray(
    Schema.Union(SlashSuggestionSchema, MentionSuggestionSchema),
  ),
  hasMore: Schema.Boolean,
}) satisfies Schema.Schema<AutocompleteSuggestions>;

const SessionChangedEventSchema = Schema.Struct({
  type: Schema.Literal("session_changed"),
});

const ContextSwitchEventSchema = Schema.Struct({
  type: Schema.Literal("context_switch"),
  phase: Schema.Literal("started", "completed", "cancelled"),
});

const AgentEndEventSchema = Schema.Struct({
  type: Schema.Literal("agent_end"),
});

const AgentStartEventSchema = Schema.Struct({
  type: Schema.Literal("agent_start"),
});

const TurnEndEventSchema = Schema.Struct({
  type: Schema.Literal("turn_end"),
});

const TurnStartEventSchema = Schema.Struct({
  type: Schema.Literal("turn_start"),
});

const AgentMessageBoundaryEventSchema = Schema.Struct({
  type: Schema.Literal("message_end", "message_start"),
  messageId: Schema.String,
  role: AgentMessageRoleSchema,
  text: Schema.String,
  timestamp: Schema.Number,
});

const AgentMessageUpdateEventSchema = Schema.Struct({
  type: Schema.Literal("message_update"),
  messageId: Schema.String,
  role: AgentMessageRoleSchema,
  text: Schema.String,
  delta: Schema.optional(Schema.String),
  timestamp: Schema.Number,
});

const ToolExecutionEndEventSchema = Schema.Struct({
  type: Schema.Literal("tool_execution_end"),
  toolCallId: Schema.String,
  toolName: Schema.String,
  result: Schema.Unknown,
  isError: Schema.Boolean,
});

const ToolExecutionStartEventSchema = Schema.Struct({
  type: Schema.Literal("tool_execution_start"),
  toolCallId: Schema.String,
  toolName: Schema.String,
  args: Schema.Unknown,
});

const ToolExecutionUpdateEventSchema = Schema.Struct({
  type: Schema.Literal("tool_execution_update"),
  toolCallId: Schema.String,
  toolName: Schema.String,
  args: Schema.Unknown,
  partialResult: Schema.Unknown,
});

const ModelChangedEventSchema = Schema.Struct({
  type: Schema.Literal("model_changed"),
  providerId: Schema.String,
  modelId: Schema.String,
});

export const PiDesktopAgentEventSchema = Schema.Union(
  SessionChangedEventSchema,
  ContextSwitchEventSchema,
  AgentEndEventSchema,
  AgentStartEventSchema,
  TurnEndEventSchema,
  TurnStartEventSchema,
  AgentMessageBoundaryEventSchema,
  AgentMessageUpdateEventSchema,
  ToolExecutionEndEventSchema,
  ToolExecutionStartEventSchema,
  ToolExecutionUpdateEventSchema,
  ModelChangedEventSchema,
) satisfies Schema.Schema<PiDesktopAgentEvent>;

function createVoidResponseContract<TRequest>(
  channel: string,
  request: Schema.Schema<TRequest>,
) {
  return createIpcContract({
    channel,
    request,
    response: Schema.Void,
  });
}

function createNoPayloadVoidContract(channel: string) {
  return createVoidResponseContract(channel, Schema.Void);
}

function createNoPayloadContract<TResponse>(
  channel: string,
  response: Schema.Schema<TResponse>,
): NoPayloadIpcContract<TResponse> {
  return createIpcContract({
    channel,
    request: Schema.Void,
    response,
  });
}

export const agentContracts = {
  getOAuthProviders: createNoPayloadContract(
    IPC_CHANNELS.agent.getOAuthProviders,
    OAuthProviderSnapshotArraySchema,
  ),
  loginWithOAuth: createVoidResponseContract(
    IPC_CHANNELS.agent.loginWithOAuth,
    AgentLoginWithOAuthRequestSchema,
  ),
  logoutOAuth: createVoidResponseContract(
    IPC_CHANNELS.agent.logoutOAuth,
    AgentLogoutOAuthRequestSchema,
  ),
  prompt: createVoidResponseContract(
    IPC_CHANNELS.agent.prompt,
    AgentPromptRequestSchema,
  ),
  cancelPrompt: createNoPayloadVoidContract(IPC_CHANNELS.agent.cancelPrompt),
  reset: createNoPayloadVoidContract(IPC_CHANNELS.agent.reset),
  switchModel: createIpcContract({
    channel: IPC_CHANNELS.agent.switchModel,
    request: AgentSwitchModelRequestSchema,
    response: ModelSwitchResultSchema,
  }),
  getDiscovery: createNoPayloadContract(
    IPC_CHANNELS.agent.getDiscovery,
    PiDiscoveryResultSchema,
  ),
  getSlashSuggestions: createIpcContract({
    channel: IPC_CHANNELS.agent.getSlashSuggestions,
    request: AgentAutocompleteContextSchema,
    response: AutocompleteSuggestionsSchema,
  }),
  oauthPrompt: createIpcEventContract({
    channel: IPC_CHANNELS.agent.oauthPrompt,
    payload: OAuthPromptRequestSchema,
  }),
  respondOAuthPrompt: createVoidResponseContract(
    IPC_CHANNELS.agent.respondOAuthPrompt,
    OAuthPromptResponseSchema,
  ),
  event: createIpcEventContract({
    channel: IPC_CHANNELS.agent.event,
    payload: PiDesktopAgentEventSchema,
  }),
} as const;

type AssignableTo<Decoded, Target> = Decoded extends Target ? true : never;

type _AgentEventAssignable = AssignableTo<
  Schema.Schema.Type<typeof PiDesktopAgentEventSchema>,
  PiDesktopAgentEvent
>;
type _AutocompleteContextAssignable = AssignableTo<
  Schema.Schema.Type<typeof AgentAutocompleteContextSchema>,
  AutocompleteContext
>;
type _AutocompleteSuggestionsAssignable = AssignableTo<
  Schema.Schema.Type<typeof AutocompleteSuggestionsSchema>,
  AutocompleteSuggestions
>;

export type AgentContractSchemasAssignable =
  | _AgentEventAssignable
  | _AutocompleteContextAssignable
  | _AutocompleteSuggestionsAssignable;

export const agentContractList = [
  agentContracts.getOAuthProviders,
  agentContracts.loginWithOAuth,
  agentContracts.logoutOAuth,
  agentContracts.prompt,
  agentContracts.cancelPrompt,
  agentContracts.reset,
  agentContracts.switchModel,
  agentContracts.getDiscovery,
  agentContracts.getSlashSuggestions,
  agentContracts.oauthPrompt,
  agentContracts.respondOAuthPrompt,
  agentContracts.event,
] as const;
