import type { SettingsSnapshot } from "@pi-desktop/shared";

export type PiThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | undefined;

export function mapThinkingLevel(
  level: PiThinkingLevel,
): SettingsSnapshot["thinkingLevel"] {
  switch (level) {
    case "off":
      return "none";
    case "minimal":
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
    case "xhigh":
      return "high";
    default:
      return undefined;
  }
}
