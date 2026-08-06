import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  FsDeleteFileRequestSchema,
  FsMoveFileRequestSchema,
  FsReadDirectoryRequestSchema,
  FsReadFileRequestSchema,
  FsRenameFileRequestSchema,
  FsWriteFileRequestSchema,
  fsContracts,
} from "./fs.js";
import {
  MAX_IPC_STRING_BYTES,
  MAX_WRITE_FILE_BYTES,
} from "./schema-primitives.js";

describe("fs request schemas", () => {
  it("accepts valid readDirectory payloads", () => {
    expect(
      Schema.decodeUnknownSync(FsReadDirectoryRequestSchema)({
        path: "/repo/src",
      }),
    ).toEqual({ path: "/repo/src" });
  });

  it("rejects readDirectory payloads with missing path", () => {
    expect(() =>
      Schema.decodeUnknownSync(FsReadDirectoryRequestSchema)({}),
    ).toThrow();
  });

  it("rejects readDirectory paths exceeding the IPC string cap", () => {
    expect(() =>
      Schema.decodeUnknownSync(FsReadDirectoryRequestSchema)({
        path: "a".repeat(MAX_IPC_STRING_BYTES + 1),
      }),
    ).toThrow();
  });

  it("rejects writeFile payloads with oversized content", () => {
    expect(() =>
      Schema.decodeUnknownSync(FsWriteFileRequestSchema)({
        path: "notes.txt",
        content: "a".repeat(MAX_WRITE_FILE_BYTES + 1),
      }),
    ).toThrow();
  });

  it("accepts writeFile payloads within the write cap", () => {
    expect(
      Schema.decodeUnknownSync(FsWriteFileRequestSchema)({
        path: "notes.txt",
        content: "hello",
      }),
    ).toEqual({ path: "notes.txt", content: "hello" });
  });

  it("rejects rename/move payloads with wrong field types", () => {
    expect(() =>
      Schema.decodeUnknownSync(FsRenameFileRequestSchema)({
        oldPath: 1,
        newPath: "b.txt",
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(FsMoveFileRequestSchema)({
        sourcePath: "a.txt",
        destinationPath: null,
      }),
    ).toThrow();
  });

  it("rejects deleteFile payloads that are not objects", () => {
    expect(() =>
      Schema.decodeUnknownSync(FsDeleteFileRequestSchema)("bad"),
    ).toThrow();
  });

  it("rejects readFile payloads with non-string path", () => {
    expect(() =>
      Schema.decodeUnknownSync(FsReadFileRequestSchema)({ path: 42 }),
    ).toThrow();
  });
});

describe("fsContracts", () => {
  it("declares all filesystem invoke channels", () => {
    expect(fsContracts.readDirectory.channel).toBe("fs:readDirectory");
    expect(fsContracts.readFile.channel).toBe("fs:readFile");
    expect(fsContracts.writeFile.channel).toBe("fs:writeFile");
    expect(fsContracts.deleteFile.channel).toBe("fs:deleteFile");
    expect(fsContracts.renameFile.channel).toBe("fs:renameFile");
    expect(fsContracts.moveFile.channel).toBe("fs:moveFile");
    expect(fsContracts.watch.channel).toBe("fs:watch");
    expect(fsContracts.unwatch.channel).toBe("fs:unwatch");
    expect(fsContracts.event.channel).toBe("fs:event");
  });
});
