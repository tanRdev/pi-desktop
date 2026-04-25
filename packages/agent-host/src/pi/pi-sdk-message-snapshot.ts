import type { AgentMessageSnapshot } from "@pi-desktop/shared";

type StructuredMessage = {
  role: string;
  timestamp: number;
  content?: string | Array<{ type?: string; text?: string }>;
  customType?: string;
  display?: boolean;
};

function isStructuredMessage(value: unknown): value is StructuredMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    "timestamp" in value
  );
}

function toSnapshotRole(role: string): AgentMessageSnapshot["role"] | null {
  if (role === "assistant" || role === "system" || role === "user") {
    return role;
  }

  if (role === "custom") {
    return "system";
  }

  if (role === "toolResult") {
    return "tool";
  }

  return null;
}

function getMessageText(message: StructuredMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((item) =>
      item && typeof item.text === "string" ? [item.text] : [],
    )
    .join("");
}

function getMessageId(
  message: StructuredMessage,
  role: AgentMessageSnapshot["role"],
): string {
  if (message.role === "custom" && typeof message.customType === "string") {
    return `custom-${message.customType}-${message.timestamp}`;
  }

  return `${role}-${message.timestamp}`;
}

export function toSnapshotMessages(
  messages: unknown[],
): AgentMessageSnapshot[] {
  return messages.flatMap((message) => {
    if (!isStructuredMessage(message)) {
      return [];
    }

    const role = toSnapshotRole(message.role);

    if (!role) {
      return [];
    }

    if (message.role === "custom" && message.display === false) {
      return [];
    }

    return [
      {
        id: getMessageId(message, role),
        role,
        text: getMessageText(message),
        status: "complete",
        timestamp: message.timestamp,
      },
    ];
  });
}
