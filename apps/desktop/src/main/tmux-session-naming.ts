import { createHash } from "node:crypto";

const TMUX_THREAD_PREFIX = "pidesk-thread";
const MAX_SESSION_NAME_LENGTH = 48;

export function createTmuxThreadSessionName(threadId: string): string {
  const sanitized = threadId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stem = sanitized.slice(0, 20) || "thread";
  const hash = createHash("sha1").update(threadId).digest("hex").slice(0, 8);
  const sessionName = `${TMUX_THREAD_PREFIX}-${stem}-${hash}`;

  return sessionName.slice(0, MAX_SESSION_NAME_LENGTH);
}

export function isManagedTmuxThreadSession(sessionName: string): boolean {
  return sessionName.startsWith(`${TMUX_THREAD_PREFIX}-`);
}
