import { describe, expect, it } from "vitest";

import {
  consumeJsonLines,
  MAX_RPC_LINE_CHARS,
  safeJsonParse,
  serializeRpcCommand,
} from "./pi-cli-rpc-framing.js";

describe("consumeJsonLines", () => {
  it("returns complete lines and preserves trailing remainder across chunks", () => {
    const first = consumeJsonLines("", '{"a":1}\n{"b"');
    expect(first).toEqual({
      lines: ['{"a":1}'],
      remainder: '{"b"',
    });

    const second = consumeJsonLines(first.remainder, ':2}\n\n{"c":3}\nleft');
    expect(second).toEqual({
      lines: ['{"b":2}', '{"c":3}'],
      remainder: "left",
    });
  });

  it("drops an unterminated remainder that exceeds the line bound instead of buffering it forever", () => {
    const oversized = "x".repeat(MAX_RPC_LINE_CHARS + 1);
    const framed = consumeJsonLines("", oversized);

    expect(framed.lines).toEqual([]);
    expect(framed.remainder).toBe("");

    // Framing resynchronizes at the next newline after the dropped payload.
    const next = consumeJsonLines(framed.remainder, '{"ok":true}\n');
    expect(next.lines).toEqual(['{"ok":true}']);
  });

  it("drops a single completed line that exceeds the line bound", () => {
    const oversized = "x".repeat(MAX_RPC_LINE_CHARS + 1);
    const framed = consumeJsonLines("", `${oversized}\n{"ok":true}\n`);

    expect(framed.lines).toEqual(['{"ok":true}']);
    expect(framed.remainder).toBe("");
  });
});

describe("safeJsonParse", () => {
  it("returns parsed JSON for valid payloads", () => {
    expect(safeJsonParse('{"ok":true}')).toEqual({ ok: true });
  });

  it("returns null for invalid JSON", () => {
    expect(safeJsonParse("{")).toBeNull();
  });
});

describe("serializeRpcCommand", () => {
  it("serializes commands as a single newline-delimited JSON line", () => {
    expect(serializeRpcCommand({ id: "1", type: "get_state" })).toBe(
      '{"id":"1","type":"get_state"}\n',
    );
  });
});
