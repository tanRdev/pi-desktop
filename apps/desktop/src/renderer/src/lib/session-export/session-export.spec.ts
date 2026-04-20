import { describe, expect, it } from "vitest";
import { cloneForExport, exportSession, importSession } from "./session-export";

describe("exportSession", () => {
  it("produces valid JSON with metadata", () => {
    const session = { worktreeId: "wt-1", data: "hello" };
    const result = exportSession(session);
    const parsed = JSON.parse(result);

    expect(parsed.version).toBe(1);
    expect(parsed.appVersion).toBe("0.1.0");
    expect(typeof parsed.exportDate).toBe("string");
    expect(parsed.session).toEqual({ worktreeId: "wt-1", data: "hello" });
  });

  it("redacts sensitive fields during export", () => {
    const session = {
      worktreeId: "wt-1",
      token: "secret-token",
      password: "hunter2",
      apiKey: "sk-1234",
      safe: "keep-me",
    };
    const result = exportSession(session);
    const parsed = JSON.parse(result);

    expect(parsed.session.token).toBe("[REDACTED]");
    expect(parsed.session.password).toBe("[REDACTED]");
    expect(parsed.session.apiKey).toBe("[REDACTED]");
    expect(parsed.session.safe).toBe("keep-me");
  });

  it("deep clones — mutations to original do not affect export", () => {
    const session = { worktreeId: "wt-1", nested: { value: 1 } };
    const json = exportSession(session);
    session.nested.value = 999;
    const parsed = JSON.parse(json);
    expect(parsed.session.nested.value).toBe(1);
  });
});

describe("importSession", () => {
  it("round-trips an exported session", () => {
    const session = { worktreeId: "wt-1", data: "hello" };
    const json = exportSession(session);
    const result = importSession(json);

    expect(result.session).toEqual({ worktreeId: "wt-1", data: "hello" });
    expect(result.warnings).toEqual([]);
  });

  it("throws on invalid JSON", () => {
    expect(() => importSession("not json at all")).toThrow("Invalid JSON");
  });

  it("throws when root is not an object", () => {
    expect(() => importSession("42")).toThrow("Invalid structure");
  });

  it("throws when version field is missing", () => {
    expect(() => importSession(JSON.stringify({ session: {} }))).toThrow(
      "missing or invalid 'version'",
    );
  });

  it("throws when session field is missing", () => {
    expect(() => importSession(JSON.stringify({ version: 1 }))).toThrow(
      "missing 'session'",
    );
  });

  it("throws when session is not an object", () => {
    expect(() =>
      importSession(JSON.stringify({ version: 1, session: "nope" })),
    ).toThrow("'session' must be a JSON object");
  });

  it("produces warning on version mismatch", () => {
    const json = JSON.stringify({
      version: 99,
      session: { worktreeId: "wt-1" },
    });
    const result = importSession(json);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Version mismatch");
    expect(result.warnings[0]).toContain("99");
  });

  it("produces warning for unknown top-level fields", () => {
    const json = JSON.stringify({
      version: 1,
      session: { worktreeId: "wt-1" },
      unknownField: "surprise",
    });
    const result = importSession(json);
    expect(result.warnings).toContain(
      "Unknown field in envelope: 'unknownField'",
    );
  });

  it("returns session data correctly when valid", () => {
    const json = JSON.stringify({
      version: 1,
      exportDate: "2025-01-01T00:00:00.000Z",
      appVersion: "0.1.0",
      session: { worktreeId: "wt-test", items: [1, 2, 3] },
    });
    const result = importSession(json);
    expect(result.session).toEqual({ worktreeId: "wt-test", items: [1, 2, 3] });
  });
});

describe("cloneForExport", () => {
  it("strips sensitive keys at any depth", () => {
    const data = {
      safe: "yes",
      nested: {
        password: "secret",
        token: "abc",
        deep: {
          apiKey: "key",
          keep: "this",
        },
      },
    };
    const cloned = cloneForExport(data);
    expect(cloned).toEqual({
      safe: "yes",
      nested: {
        password: "[REDACTED]",
        token: "[REDACTED]",
        deep: {
          apiKey: "[REDACTED]",
          keep: "this",
        },
      },
    });
  });

  it("redacts items in arrays", () => {
    const data = {
      users: [
        { name: "alice", password: "p1" },
        { name: "bob", token: "t2" },
      ],
    };
    const cloned = cloneForExport(data);
    expect(cloned).toEqual({
      users: [
        { name: "alice", password: "[REDACTED]" },
        { name: "bob", token: "[REDACTED]" },
      ],
    });
  });

  it("does not mutate the original", () => {
    const original = { password: "secret", data: "keep" };
    const cloned = cloneForExport(original);
    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === "object" && v !== null && !Array.isArray(v);
    }
    if (!isObject(cloned)) throw new Error("expected object");
    expect(cloned.password).toBe("[REDACTED]");
    expect(original.password).toBe("secret");
  });

  it("handles primitives and null", () => {
    expect(cloneForExport(null)).toBe(null);
    expect(cloneForExport(undefined)).toBe(undefined);
    expect(cloneForExport(42)).toBe(42);
    expect(cloneForExport("hello")).toBe("hello");
    expect(cloneForExport(true)).toBe(true);
  });
});
