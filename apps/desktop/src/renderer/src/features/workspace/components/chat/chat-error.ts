export type ChatErrorKind = "auth" | "token" | "model" | "generic";

export interface ChatErrorPresentation {
  kind: ChatErrorKind;
  title: string;
  /** Short next-step guidance shown under the title (not a raw stack dump). */
  guidance: string;
}

/**
 * Map agent error strings to user-facing titles + next steps.
 * Prefer structured codes when present; fall back to keyword hints.
 * Never use the raw error string as the title.
 */
export function describeChatError(lastError: string): ChatErrorPresentation {
  const normalized = lastError.toLowerCase();

  if (
    normalized.includes("auth") ||
    normalized.includes("oauth") ||
    normalized.includes("unauthor") ||
    normalized.includes("401") ||
    normalized.includes("login") ||
    normalized.includes("credential") ||
    normalized.includes("api key") ||
    normalized.includes("not authenticated")
  ) {
    return {
      kind: "auth",
      title: "Sign-in required",
      guidance:
        "Connect or re-authenticate the provider, then retry your last message.",
    };
  }

  if (
    normalized.includes("token") ||
    normalized.includes("context length") ||
    normalized.includes("too long") ||
    normalized.includes("max_tokens")
  ) {
    return {
      kind: "token",
      title: "Context limit reached",
      guidance: "Start a new Thread or shorten the prompt, then try again.",
    };
  }

  if (
    normalized.includes("model") ||
    normalized.includes("provider") ||
    normalized.includes("not found") ||
    normalized.includes("unavailable")
  ) {
    return {
      kind: "model",
      title: "Model unavailable",
      guidance:
        "Pick another model in the prompt dock, then retry your last message.",
    };
  }

  return {
    kind: "generic",
    title: "Something went wrong",
    guidance:
      "Retry your last message. If it keeps failing, check the provider connection.",
  };
}
