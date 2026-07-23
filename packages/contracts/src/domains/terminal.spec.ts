import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  MAX_IPC_STRING_BYTES,
  MAX_TERMINAL_WRITE_BYTES,
} from "./schema-primitives.js";
import {
  TerminalCreateRequestSchema,
  TerminalDestroyRequestSchema,
  TerminalEventSchema,
  TerminalResizeRequestSchema,
  TerminalWriteRequestSchema,
  terminalContracts,
} from "./terminal.js";

describe("terminal request schemas", () => {
  it("accepts valid terminal.create payloads", () => {
    expect(
      Schema.decodeUnknownSync(TerminalCreateRequestSchema)({
        id: "term-1",
        cols: 120,
        rows: 40,
        ownerWindowId: "win-1",
        cwd: "/repo",
        backend: "shell",
      }),
    ).toEqual({
      id: "term-1",
      cols: 120,
      rows: 40,
      ownerWindowId: "win-1",
      cwd: "/repo",
      backend: "shell",
    });
  });

  it("rejects terminal.create payloads with unknown keys", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalCreateRequestSchema)({
        id: "term-1",
        cols: 80,
        rows: 24,
        ownerWindowId: "win-1",
        cwd: "/repo",
        hidden: true,
      }),
    ).toThrow();
  });

  it("rejects terminal.create payloads missing required fields", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalCreateRequestSchema)({
        id: "term-1",
        cols: 80,
        rows: 24,
      }),
    ).toThrow();
  });

  it("rejects terminal.create payloads with non-finite dimensions", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalCreateRequestSchema)({
        id: "term-1",
        cols: Number.NaN,
        rows: 24,
        ownerWindowId: "win-1",
        cwd: "/repo",
      }),
    ).toThrow();
  });

  it("rejects terminal.write payloads with oversized data", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalWriteRequestSchema)({
        id: "term-1",
        data: "x".repeat(MAX_TERMINAL_WRITE_BYTES + 1),
      }),
    ).toThrow();
  });

  it("rejects terminal.write payloads with wrong types", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalWriteRequestSchema)({
        id: 123,
        data: "hi",
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TerminalWriteRequestSchema)({ data: "hi" }),
    ).toThrow();
  });

  it("rejects terminal.resize payloads with non-finite cols or rows", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalResizeRequestSchema)({
        id: "term-1",
        cols: Number.POSITIVE_INFINITY,
        rows: 24,
      }),
    ).toThrow();
  });

  it("rejects terminal.destroy payloads with oversized ids", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalDestroyRequestSchema)({
        id: "x".repeat(MAX_IPC_STRING_BYTES + 1),
      }),
    ).toThrow();
  });
});

describe("terminal event schema", () => {
  it("accepts data and exit event payloads", () => {
    expect(
      Schema.decodeUnknownSync(TerminalEventSchema)({
        type: "data",
        id: "term-1",
        data: "hello",
      }),
    ).toEqual({ type: "data", id: "term-1", data: "hello" });

    expect(
      Schema.decodeUnknownSync(TerminalEventSchema)({
        type: "exit",
        id: "term-1",
        exitCode: 0,
      }),
    ).toEqual({ type: "exit", id: "term-1", exitCode: 0 });
  });

  it("rejects malformed terminal event payloads", () => {
    expect(() =>
      Schema.decodeUnknownSync(TerminalEventSchema)({
        type: "data",
        id: "term-1",
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(TerminalEventSchema)({
        type: "exit",
        id: "term-1",
        exitCode: "0",
      }),
    ).toThrow();
  });
});

describe("terminalContracts", () => {
  it("declares all terminal invoke channels plus the event contract", () => {
    expect(terminalContracts.create.channel).toBe("terminal:create");
    expect(terminalContracts.write.channel).toBe("terminal:write");
    expect(terminalContracts.resize.channel).toBe("terminal:resize");
    expect(terminalContracts.destroy.channel).toBe("terminal:destroy");
    expect(terminalContracts.getSessions.channel).toBe("terminal:getSessions");
    expect(terminalContracts.event.kind).toBe("event");
    expect(terminalContracts.event.channel).toBe("terminal:event");
  });
});
