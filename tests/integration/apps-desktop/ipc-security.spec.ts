import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Security regression tests for every IPC handler A6 hardens.
 *
 * These tests exercise the real filesystem guards (traversal, symlinks) and
 * the payload / error-sanitization contracts. They do not require Electron —
 * the dialog / external-URL paths are covered in separate specs.
 */

async function loadPathGuards() {
  return await import("../../../apps/desktop/src/main/fs/path-guards");
}

async function loadPayloadParsers() {
  return await import("../../../apps/desktop/src/main/ipc/payload-parsers");
}

async function loadSanitizer() {
  return await import("../../../apps/desktop/src/main/ipc/sanitize-ipc-error");
}

async function loadFilesystemHandlers() {
  return await import(
    "../../../apps/desktop/src/main/ipc/register-filesystem-handlers"
  );
}

async function loadGitHandlers() {
  return await import(
    "../../../apps/desktop/src/main/ipc/register-git-handlers"
  );
}

const TMP_PREFIX = path.join(os.tmpdir(), "pi-ipc-security-");

describe("path guards - traversal", () => {
  let root: string;
  let canonicalRoot: string;

  beforeAll(() => {
    root = mkdtempSync(TMP_PREFIX);
    // On macOS, /var is a symlink to /private/var, so the canonical root
    // differs from the one returned by mkdtempSync. Account for that.
    const { realpathSync } = require("node:fs");
    canonicalRoot = realpathSync(root);
    mkdirSync(path.join(canonicalRoot, "sub"), { recursive: true });
    writeFileSync(path.join(canonicalRoot, "sub", "ok.txt"), "hello");
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("rejects .. traversal out of the root", async () => {
    const { resolveInsideRoot, PathGuardError } = await loadPathGuards();
    expect(() =>
      resolveInsideRoot([canonicalRoot], "../../../etc/passwd"),
    ).toThrow(PathGuardError);
    try {
      resolveInsideRoot([canonicalRoot], "../../../etc/passwd");
    } catch (error) {
      expect(error).toBeInstanceOf(PathGuardError);
      if (error instanceof PathGuardError) {
        expect(error.code).toBe("path/outside-root");
      }
    }
  });

  it("rejects absolute paths outside the root", async () => {
    const { resolveInsideRoot, PathGuardError } = await loadPathGuards();
    expect(() => resolveInsideRoot([canonicalRoot], "/etc/passwd")).toThrow(
      PathGuardError,
    );
  });

  it("rejects NUL bytes in the path (POSIX truncation attack)", async () => {
    const { resolveInsideRoot, PathGuardError } = await loadPathGuards();
    try {
      resolveInsideRoot([canonicalRoot], "sub/ok.txt\0.evil");
      throw new Error("expected PathGuardError");
    } catch (error) {
      expect(error).toBeInstanceOf(PathGuardError);
      if (error instanceof PathGuardError) {
        expect(error.code).toBe("path/contains-null-byte");
      }
    }
  });

  it("rejects empty and non-string paths", async () => {
    const { resolveInsideRoot, PathGuardError } = await loadPathGuards();
    expect(() => resolveInsideRoot([canonicalRoot], "")).toThrow(
      PathGuardError,
    );
    expect(() => resolveInsideRoot([canonicalRoot], 42)).toThrow(
      PathGuardError,
    );
    expect(() => resolveInsideRoot([canonicalRoot], undefined)).toThrow(
      PathGuardError,
    );
  });

  it("allows paths inside the root and returns the canonical location", async () => {
    const { resolveInsideRoot } = await loadPathGuards();
    const resolved = resolveInsideRoot([canonicalRoot], "sub/ok.txt");
    expect(resolved).toBe(path.join(canonicalRoot, "sub", "ok.txt"));
  });

  it("requires at least one allowed root", async () => {
    const { resolveInsideRoot, PathGuardError } = await loadPathGuards();
    try {
      resolveInsideRoot([], "anything");
      throw new Error("expected PathGuardError");
    } catch (error) {
      expect(error).toBeInstanceOf(PathGuardError);
      if (error instanceof PathGuardError) {
        expect(error.code).toBe("path/no-root-configured");
      }
    }
  });
});

describe("path guards - symlink escape", () => {
  let outsideDir: string;
  let rootDir: string;
  let canonicalRoot: string;

  beforeAll(() => {
    outsideDir = mkdtempSync(`${TMP_PREFIX}outside-`);
    rootDir = mkdtempSync(`${TMP_PREFIX}root-`);
    const { realpathSync } = require("node:fs");
    canonicalRoot = realpathSync(rootDir);
    writeFileSync(path.join(outsideDir, "secret.txt"), "SECRET");
    // Create a symlink inside the root that points OUT of the root.
    symlinkSync(
      path.join(outsideDir, "secret.txt"),
      path.join(canonicalRoot, "escape-link"),
    );
  });

  afterAll(() => {
    rmSync(outsideDir, { recursive: true, force: true });
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("rejects a symlink whose target is outside the root", async () => {
    const { resolveInsideRoot, PathGuardError } = await loadPathGuards();
    try {
      resolveInsideRoot([canonicalRoot], "escape-link");
      throw new Error("expected PathGuardError");
    } catch (error) {
      expect(error).toBeInstanceOf(PathGuardError);
      if (error instanceof PathGuardError) {
        expect(error.code).toBe("path/symlink-escape");
      }
    }
  });
});

describe("payload-parsers - strict validation", () => {
  it("caps strings at MAX_STRING_BYTES", async () => {
    const { getStringField, PayloadValidationError, MAX_STRING_BYTES } =
      await loadPayloadParsers();
    const giant = "x".repeat(MAX_STRING_BYTES + 1);
    expect(() => getStringField({ value: giant }, "value")).toThrow(
      PayloadValidationError,
    );
  });

  it("caps arrays at MAX_ARRAY_LENGTH", async () => {
    const { getStringArrayField, PayloadValidationError, MAX_ARRAY_LENGTH } =
      await loadPayloadParsers();
    const huge = new Array(MAX_ARRAY_LENGTH + 1).fill("x");
    expect(() => getStringArrayField({ list: huge }, "list")).toThrow(
      PayloadValidationError,
    );
  });

  it("requireStringField rejects missing fields with stable code", async () => {
    const { requireStringField, PayloadValidationError } =
      await loadPayloadParsers();
    try {
      requireStringField({}, "path");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/missing-field");
        expect(error.field).toBe("path");
      }
    }
  });

  it("requireStringField rejects wrong types with stable code", async () => {
    const { requireStringField, PayloadValidationError } =
      await loadPayloadParsers();
    try {
      requireStringField({ path: 123 }, "path");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/wrong-type");
      }
    }
  });

  it("parseDialogOptionsStrict rejects unknown keys", async () => {
    const { parseDialogOptionsStrict, PayloadValidationError } =
      await loadPayloadParsers();
    try {
      parseDialogOptionsStrict({ title: "ok", defaultPath: "/etc" });
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/unknown-keys");
      }
    }
  });

  it("parseDialogOptionsStrict filters non-allowed property strings", async () => {
    const { parseDialogOptionsStrict } = await loadPayloadParsers();
    const parsed = parseDialogOptionsStrict({
      title: "Pick",
      properties: ["openFile", "promptToCreate", "evil-prop"],
    });
    expect(parsed.title).toBe("Pick");
    expect(parsed.properties).toEqual(["openFile", "promptToCreate"]);
  });

  it("parseSearchRequestStrict rejects unknown keys", async () => {
    const { parseSearchRequestStrict, PayloadValidationError } =
      await loadPayloadParsers();
    try {
      parseSearchRequestStrict({
        query: "q",
        rootPath: "/r",
        hacker: "yes",
      });
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/unknown-keys");
      }
    }
  });

  it("rejects NaN / Infinity numeric fields", async () => {
    const { getNumberField } = await loadPayloadParsers();
    expect(getNumberField({ x: Number.NaN }, "x")).toBeUndefined();
    expect(
      getNumberField({ x: Number.POSITIVE_INFINITY }, "x"),
    ).toBeUndefined();
    expect(getNumberField({ x: 12 }, "x")).toBe(12);
  });
});

describe("sanitizeIpcError - redaction", () => {
  it("redacts the current user's home directory", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const home = os.homedir();
    const input = new Error(`cannot open ${home}/Documents/secret.env`);
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect(cleaned.message).not.toContain(home);
    // One of <home> or <path> must appear.
    expect(cleaned.message).toMatch(/<home>|<path>/);
  });

  it("redacts GitHub tokens", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error(
      "git push failed: remote: Bad credentials ghp_abcdefghij1234567890ABCD",
    );
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect(cleaned.message).not.toMatch(/ghp_[A-Za-z0-9]/);
    expect(cleaned.message).toContain("<token>");
  });

  it("redacts OpenAI-style keys", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("bad key sk-proj-abcDEF123_456-xyz used");
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect(cleaned.message).not.toMatch(/sk-proj-[A-Za-z]/);
    expect(cleaned.message).toContain("<token>");
  });

  it("redacts Anthropic-style keys", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("sk-ant-api03-SECRETSECRETSECRET bad");
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect(cleaned.message).not.toMatch(/sk-ant-[A-Za-z]/);
    expect(cleaned.message).toContain("<token>");
  });

  it("redacts bearer tokens", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("401: Authorization: Bearer abc.def.ghi123-xyz");
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect(cleaned.message).not.toMatch(/Bearer\s+[A-Za-z]/);
    expect(cleaned.message).toContain("<token>");
  });

  it("redacts email addresses", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("user alice@example.com has no permissions");
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect(cleaned.message).not.toContain("alice@example.com");
    expect(cleaned.message).toContain("<email>");
  });

  it("redacts AWS access keys", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("aws creds AKIAIOSFODNN7EXAMPLE rejected");
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect(cleaned.message).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(cleaned.message).toContain("<token>");
  });

  it("preserves structured error codes (code property)", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("something bad");
    Object.defineProperty(input, "code", {
      value: "path/outside-root",
      enumerable: true,
    });
    const cleaned = sanitizeIpcError(input, { log: () => undefined });
    expect((cleaned as { code?: unknown }).code).toBe("path/outside-root");
  });
});

describe("filesystem handlers - end-to-end security", () => {
  let root: string;
  let canonicalRoot: string;
  let handlers: Map<string, (event: unknown, payload: unknown) => unknown>;

  beforeAll(async () => {
    root = mkdtempSync(`${TMP_PREFIX}fs-`);
    const { realpathSync } = require("node:fs");
    canonicalRoot = realpathSync(root);
    writeFileSync(path.join(canonicalRoot, "hi.txt"), "hello");

    const { registerFilesystemHandlers } = await loadFilesystemHandlers();
    handlers = new Map();
    registerFilesystemHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      getWorkspaceRootPath: () => canonicalRoot,
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("readFile rejects traversal", async () => {
    const { PathGuardError } = await loadPathGuards();
    const listener = handlers.get("fs:readFile");
    if (!listener) throw new Error("handler not registered");
    await expect(
      listener(undefined, { path: "../../etc/passwd" }),
    ).rejects.toBeInstanceOf(PathGuardError);
  });

  it("readFile rejects missing path with stable code", async () => {
    const { PayloadValidationError } = await loadPayloadParsers();
    const listener = handlers.get("fs:readFile");
    if (!listener) throw new Error("handler not registered");
    try {
      await listener(undefined, {});
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
    }
  });

  it("writeFile rejects oversized content", async () => {
    const { PayloadValidationError } = await loadPayloadParsers();
    const listener = handlers.get("fs:writeFile");
    if (!listener) throw new Error("handler not registered");
    const giant = "a".repeat(11 * 1024 * 1024);
    try {
      await listener(undefined, { path: "big.txt", content: giant });
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/string-too-large");
      }
    }
  });

  it("readFile accepts a valid path inside the root", async () => {
    const listener = handlers.get("fs:readFile");
    if (!listener) throw new Error("handler not registered");
    const result = await listener(undefined, { path: "hi.txt" });
    expect(result).toMatchObject({ type: "text", content: "hello" });
  });

  it("readDirectory returns structured error for out-of-root paths", async () => {
    const listener = handlers.get("fs:readDirectory");
    if (!listener) throw new Error("handler not registered");
    const result = await listener(undefined, { path: "../../etc" });
    expect(result).toMatchObject({ success: false, code: "path/outside-root" });
  });
});

describe("git handlers - repository path guard", () => {
  let handlers: Map<string, (event: unknown, payload: unknown) => unknown>;
  let allowedRoot: string;

  beforeAll(async () => {
    allowedRoot = mkdtempSync(`${TMP_PREFIX}git-`);
    const { realpathSync } = require("node:fs");
    allowedRoot = realpathSync(allowedRoot);

    const { registerGitHandlers } = await loadGitHandlers();
    const { GitWorktreeService } = await import(
      "../../../apps/desktop/src/main/git-worktree-service"
    );
    handlers = new Map();
    // The test does not exercise real git — we only care that the guard
    // runs before the service is called. A real instance is fine because
    // none of the tests below reach the service (all fail at validation).
    const stubService = new GitWorktreeService();
    registerGitHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      gitService: stubService,
      getAllowedRepositoryRoots: () => [allowedRoot],
    });
  });

  afterAll(() => {
    rmSync(allowedRoot, { recursive: true, force: true });
  });

  it("rejects repositoryPath outside the allowed roots", async () => {
    const { PathGuardError } = await loadPathGuards();
    const listener = handlers.get("git:getRepositoryStatus");
    if (!listener) throw new Error("handler not registered");
    await expect(
      listener(undefined, { repositoryPath: "/etc" }),
    ).rejects.toBeInstanceOf(PathGuardError);
  });

  it("rejects oversized commit messages", async () => {
    const { PayloadValidationError } = await loadPayloadParsers();
    const listener = handlers.get("git:commit");
    if (!listener) throw new Error("handler not registered");
    try {
      await listener(undefined, {
        repositoryPath: allowedRoot,
        message: "x".repeat(200 * 1024),
      });
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/string-too-large");
      }
    }
  });

  it("rejects empty filePaths arrays for stageFiles", async () => {
    const { PayloadValidationError } = await loadPayloadParsers();
    const listener = handlers.get("git:stageFiles");
    if (!listener) throw new Error("handler not registered");
    try {
      await listener(undefined, {
        repositoryPath: allowedRoot,
        filePaths: [],
      });
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/empty-array");
      }
    }
  });
});
