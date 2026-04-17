import { describe, expect, it, vi } from "vitest";

async function loadModule() {
  return await import("../../../apps/desktop/src/main/ipc/sanitize-ipc-error");
}

describe("sanitizeIpcError", () => {
  it("strips the stack trace from the returned Error", async () => {
    const { sanitizeIpcError } = await loadModule();
    const input = new Error("boom");
    input.stack =
      "Error: boom\n    at /Users/tan/secret/file.ts:10:5\n    at /Users/tan/other.ts:3:1";

    const sanitized = sanitizeIpcError(input, { log: () => undefined });

    expect(sanitized).toBeInstanceOf(Error);
    expect(sanitized.stack).toBeUndefined();
  });

  it("replaces absolute POSIX paths in the message with <path>", async () => {
    const { sanitizeIpcError } = await loadModule();
    const input = new Error(
      "ENOENT: no such file or directory, open '/Users/tan/.superset/secret.env'",
    );

    const sanitized = sanitizeIpcError(input, { log: () => undefined });

    expect(sanitized.message).not.toMatch(/\/Users\/tan/);
    expect(sanitized.message).toMatch(/<path>/);
    expect(sanitized.message).toMatch(/ENOENT/);
  });

  it("replaces home-tilde paths with <path>", async () => {
    const { sanitizeIpcError } = await loadModule();
    const input = new Error(
      "Failed reading ~/Library/Keychains/login.keychain",
    );

    const sanitized = sanitizeIpcError(input, { log: () => undefined });

    expect(sanitized.message).not.toMatch(/~\/Library/);
    expect(sanitized.message).toMatch(/<path>/);
  });

  it("replaces Windows absolute paths with <path>", async () => {
    const { sanitizeIpcError } = await loadModule();
    const input = new Error(
      "Cannot access 'C:\\Users\\Admin\\AppData\\Local\\secret.db'",
    );

    const sanitized = sanitizeIpcError(input, { log: () => undefined });

    expect(sanitized.message).not.toMatch(/C:\\Users/);
    expect(sanitized.message).toMatch(/<path>/);
  });

  it("preserves handwritten messages without paths unchanged", async () => {
    const { sanitizeIpcError } = await loadModule();
    const input = new Error(
      "Repository path is not an allowed repository root",
    );

    const sanitized = sanitizeIpcError(input, { log: () => undefined });

    expect(sanitized.message).toBe(
      "Repository path is not an allowed repository root",
    );
  });

  it("logs the original error (with stack) via the provided logger", async () => {
    const { sanitizeIpcError } = await loadModule();
    const log = vi.fn();
    const input = new Error("ENOENT open '/Users/tan/file'");
    input.stack = "Error: ENOENT open '/Users/tan/file'\n    at foo";

    sanitizeIpcError(input, { log });

    expect(log).toHaveBeenCalledTimes(1);
    const logged = log.mock.calls[0]?.[0];
    expect(logged).toBe(input);
  });

  it("handles non-Error thrown values by wrapping them with a generic message", async () => {
    const { sanitizeIpcError } = await loadModule();
    const sanitized = sanitizeIpcError("bare string", { log: () => undefined });

    expect(sanitized).toBeInstanceOf(Error);
    expect(sanitized.message).toBe("IPC operation failed");
  });
});

describe("createSanitizingHandle", () => {
  it("passes through successful results unchanged", async () => {
    const { createSanitizingHandle } = await loadModule();
    const inner = vi.fn();
    const handle = createSanitizingHandle(inner, { log: () => undefined });

    handle("test.channel", async () => "ok");

    expect(inner).toHaveBeenCalledTimes(1);
    const [channel, listener] = inner.mock.calls[0] ?? [];
    expect(channel).toBe("test.channel");
    const result = await (listener as (e: unknown, p: unknown) => unknown)(
      undefined,
      undefined,
    );
    expect(result).toBe("ok");
  });

  it("sanitizes thrown errors from inner listeners", async () => {
    const { createSanitizingHandle } = await loadModule();
    const inner = vi.fn();
    const log = vi.fn();
    const handle = createSanitizingHandle(inner, { log });

    handle("test.channel", async () => {
      throw new Error("boom at /Users/tan/secret");
    });

    const listener = inner.mock.calls[0]?.[1];
    await expect(
      (listener as (e: unknown, p: unknown) => Promise<unknown>)(
        undefined,
        undefined,
      ),
    ).rejects.toMatchObject({ message: expect.stringMatching(/<path>/) });
    expect(log).toHaveBeenCalled();
  });
});
