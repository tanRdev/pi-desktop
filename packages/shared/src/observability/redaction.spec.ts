import { describe, expect, it } from "vitest";
import { redact, redactString } from "./redaction.js";

describe("redactString", () => {
  it("scrubs absolute POSIX paths", () => {
    expect(redactString("opened /Users/tan/work/file.txt")).toBe(
      "opened <path>",
    );
  });

  it("scrubs tilde home paths", () => {
    expect(redactString("cd ~/Projects/pi")).toBe("cd <path>");
  });

  it("scrubs Windows absolute paths", () => {
    expect(redactString("at C:\\Users\\Admin\\app.log")).toBe("at <path>");
  });

  it("scrubs emails", () => {
    expect(redactString("notify me@example.com please")).toBe(
      "notify <email> please",
    );
  });

  it("scrubs bearer tokens", () => {
    expect(redactString("Authorization: Bearer abc123DEF456ghi789")).toBe(
      "Authorization: Bearer <redacted>",
    );
  });

  it("scrubs GitHub tokens", () => {
    expect(
      redactString("token=ghp_abcdefghijklmnopqrstuvwxyzABCDEF01"),
    ).toContain("<redacted-token>");
    expect(redactString("pat=github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ")).toContain(
      "<redacted-token>",
    );
  });

  it("scrubs OpenAI-style keys", () => {
    expect(redactString("key sk-abcdefghijklmnopqrstuvwxyzABCDEF")).toContain(
      "<redacted-token>",
    );
  });

  it("scrubs long hex strings", () => {
    expect(redactString("hash=deadbeefcafebabe0123456789abcdef")).toBe(
      "hash=<redacted>",
    );
  });

  it("leaves innocuous text alone", () => {
    expect(redactString("hello world 42")).toBe("hello world 42");
  });
});

describe("redact", () => {
  it("redacts strings inside objects", () => {
    expect(redact({ msg: "at /Users/tan/x" })).toEqual({ msg: "at <path>" });
  });

  it("redacts entire secret keys regardless of value", () => {
    const input = { password: "hunter2", token: "short", note: "hi" };
    const result = redact(input);
    expect(result).toEqual({
      password: "<redacted>",
      token: "<redacted>",
      note: "hi",
    });
  });

  it("handles arrays recursively", () => {
    expect(redact(["/a/b", "plain"])).toEqual(["<path>", "plain"]);
  });

  it("passes primitives through", () => {
    expect(redact(1)).toBe(1);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
  });

  it("flattens Error instances to {name,message}", () => {
    const err = new TypeError("boom at /Users/tan/x");
    expect(redact(err)).toEqual({
      name: "TypeError",
      message: "boom at <path>",
    });
  });

  it("replaces functions and symbols with <redacted>", () => {
    expect(redact(() => 1)).toBe("<redacted>");
    expect(redact(Symbol("s"))).toBe("<redacted>");
  });

  it("breaks cycles without throwing", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    const result = redact(a);
    expect(result).toMatchObject({ name: "a", self: "<cycle>" });
  });

  it("case-insensitive secret key matching", () => {
    expect(redact({ ApiKey: "xyz", REFRESH_TOKEN: "abc" })).toEqual({
      ApiKey: "<redacted>",
      REFRESH_TOKEN: "<redacted>",
    });
  });

  it("redacts nested structures exhaustively", () => {
    const input = {
      user: {
        email: "me@example.com",
        home: "/Users/me",
        creds: { password: "p", safe: 1 },
      },
      events: ["visited /Users/me", "Bearer abcdefghijklmnop"],
    };
    expect(redact(input)).toEqual({
      user: {
        email: "<email>",
        home: "<path>",
        creds: { password: "<redacted>", safe: 1 },
      },
      events: ["visited <path>", "Bearer <redacted>"],
    });
  });
});
