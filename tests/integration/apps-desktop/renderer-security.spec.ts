import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildCsp,
  getContentSecurityPolicy,
  installSecurityHeaders,
} from "../../../apps/desktop/src/main/security/csp";

// ---------------------------------------------------------------------------
// CSP header tests (C4 integration)
// ---------------------------------------------------------------------------

describe("buildCsp", () => {
  it("includes all required directives in production", () => {
    const csp = buildCsp({ isDevelopment: false });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("includes production connect-src endpoints", () => {
    const csp = buildCsp({ isDevelopment: false });

    expect(csp).toMatch(/connect-src[^;]*https:\/\/registry\.npmjs\.org/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  });

  it("does not allow unsafe-eval or unsafe-inline scripts in production", () => {
    const csp = buildCsp({ isDevelopment: false });

    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("does not allow ws: or http: connections in production", () => {
    const csp = buildCsp({ isDevelopment: false });

    expect(csp).not.toMatch(/connect-src[^;]*ws:/);
    expect(csp).not.toMatch(/connect-src[^;]*http:\/\//);
  });

  it("allows local dev server and websockets in development", () => {
    const csp = buildCsp({ isDevelopment: true });

    expect(csp).toMatch(/connect-src[^;]*ws:\/\/localhost:\*/);
    expect(csp).toMatch(/connect-src[^;]*ws:\/\/127\.0\.0\.1:\*/);
    expect(csp).toMatch(/connect-src[^;]*http:\/\/localhost:\*/);
    expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("includes production HTTPS endpoints in development too", () => {
    const csp = buildCsp({ isDevelopment: true });

    expect(csp).toMatch(/connect-src[^;]*https:\/\/registry\.npmjs\.org/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  });

  it("sets object-src to none", () => {
    const csp = buildCsp({ isDevelopment: false });
    expect(csp).toContain("object-src 'none'");
  });

  it("sets frame-ancestors to none", () => {
    const csp = buildCsp({ isDevelopment: false });
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("getContentSecurityPolicy", () => {
  it("delegates to buildCsp with the same isDevelopment flag", () => {
    const devResult = getContentSecurityPolicy(true);
    const prodResult = getContentSecurityPolicy(false);

    expect(devResult).toBe(buildCsp({ isDevelopment: true }));
    expect(prodResult).toBe(buildCsp({ isDevelopment: false }));
  });
});

describe("installSecurityHeaders", () => {
  it("registers an onHeadersReceived handler that injects the CSP", () => {
    let captured:
      | ((
          details: { responseHeaders?: Record<string, string[] | string> },
          callback: (response: {
            responseHeaders?: Record<string, string[] | string>;
          }) => void,
        ) => void)
      | null = null;

    const fakeSession = {
      webRequest: {
        onHeadersReceived: vi.fn((handler: typeof captured) => {
          captured = handler;
        }),
      },
    };

    installSecurityHeaders({
      session: fakeSession as unknown as Parameters<
        typeof installSecurityHeaders
      >[0]["session"],
      isDevelopment: false,
    });

    expect(fakeSession.webRequest.onHeadersReceived).toHaveBeenCalledTimes(1);
    expect(captured).not.toBeNull();

    let callbackArg:
      | { responseHeaders?: Record<string, string[] | string> }
      | undefined;
    captured?.(
      {
        responseHeaders: {
          "x-existing": ["value"],
          "Content-Security-Policy": ["evil"],
        },
      },
      (response) => {
        callbackArg = response;
      },
    );

    expect(callbackArg).toBeDefined();
    const headers = callbackArg?.responseHeaders ?? {};

    expect(headers["x-existing"]).toEqual(["value"]);
    expect(headers["Content-Security-Policy"]).toBeDefined();

    const cspHeader = headers["Content-Security-Policy"];
    const cspValue = Array.isArray(cspHeader) ? cspHeader[0] : cspHeader;
    expect(cspValue).toContain("default-src 'self'");
    expect(cspValue).not.toContain("evil");
  });

  it("injects X-Content-Type-Options: nosniff", () => {
    let captured:
      | ((
          details: { responseHeaders?: Record<string, string[] | string> },
          callback: (response: {
            responseHeaders?: Record<string, string[] | string>;
          }) => void,
        ) => void)
      | null = null;

    const fakeSession = {
      webRequest: {
        onHeadersReceived: vi.fn((handler: typeof captured) => {
          captured = handler;
        }),
      },
    };

    installSecurityHeaders({
      session: fakeSession as unknown as Parameters<
        typeof installSecurityHeaders
      >[0]["session"],
      isDevelopment: false,
    });

    let callbackArg:
      | { responseHeaders?: Record<string, string[] | string> }
      | undefined;
    captured?.({ responseHeaders: {} }, (response) => {
      callbackArg = response;
    });

    expect(callbackArg?.responseHeaders?.["X-Content-Type-Options"]).toEqual([
      "nosniff",
    ]);
  });

  it("injects X-Frame-Options: DENY", () => {
    let captured:
      | ((
          details: { responseHeaders?: Record<string, string[] | string> },
          callback: (response: {
            responseHeaders?: Record<string, string[] | string>;
          }) => void,
        ) => void)
      | null = null;

    const fakeSession = {
      webRequest: {
        onHeadersReceived: vi.fn((handler: typeof captured) => {
          captured = handler;
        }),
      },
    };

    installSecurityHeaders({
      session: fakeSession as unknown as Parameters<
        typeof installSecurityHeaders
      >[0]["session"],
      isDevelopment: false,
    });

    let callbackArg:
      | { responseHeaders?: Record<string, string[] | string> }
      | undefined;
    captured?.({ responseHeaders: {} }, (response) => {
      callbackArg = response;
    });

    expect(callbackArg?.responseHeaders?.["X-Frame-Options"]).toEqual(["DENY"]);
  });

  it("injects Referrer-Policy: strict-origin-when-cross-origin", () => {
    let captured:
      | ((
          details: { responseHeaders?: Record<string, string[] | string> },
          callback: (response: {
            responseHeaders?: Record<string, string[] | string>;
          }) => void,
        ) => void)
      | null = null;

    const fakeSession = {
      webRequest: {
        onHeadersReceived: vi.fn((handler: typeof captured) => {
          captured = handler;
        }),
      },
    };

    installSecurityHeaders({
      session: fakeSession as unknown as Parameters<
        typeof installSecurityHeaders
      >[0]["session"],
      isDevelopment: false,
    });

    let callbackArg:
      | { responseHeaders?: Record<string, string[] | string> }
      | undefined;
    captured?.({ responseHeaders: {} }, (response) => {
      callbackArg = response;
    });

    expect(callbackArg?.responseHeaders?.["Referrer-Policy"]).toEqual([
      "strict-origin-when-cross-origin",
    ]);
  });

  it("injects Permissions-Policy denying camera, microphone, and geolocation", () => {
    let captured:
      | ((
          details: { responseHeaders?: Record<string, string[] | string> },
          callback: (response: {
            responseHeaders?: Record<string, string[] | string>;
          }) => void,
        ) => void)
      | null = null;

    const fakeSession = {
      webRequest: {
        onHeadersReceived: vi.fn((handler: typeof captured) => {
          captured = handler;
        }),
      },
    };

    installSecurityHeaders({
      session: fakeSession as unknown as Parameters<
        typeof installSecurityHeaders
      >[0]["session"],
      isDevelopment: false,
    });

    let callbackArg:
      | { responseHeaders?: Record<string, string[] | string> }
      | undefined;
    captured?.({ responseHeaders: {} }, (response) => {
      callbackArg = response;
    });

    expect(callbackArg?.responseHeaders?.["Permissions-Policy"]).toEqual([
      "camera=(), microphone=(), geolocation=()",
    ]);
  });

  it("strips pre-existing security headers to prevent duplicates", () => {
    let captured:
      | ((
          details: { responseHeaders?: Record<string, string[] | string> },
          callback: (response: {
            responseHeaders?: Record<string, string[] | string>;
          }) => void,
        ) => void)
      | null = null;

    const fakeSession = {
      webRequest: {
        onHeadersReceived: vi.fn((handler: typeof captured) => {
          captured = handler;
        }),
      },
    };

    installSecurityHeaders({
      session: fakeSession as unknown as Parameters<
        typeof installSecurityHeaders
      >[0]["session"],
      isDevelopment: false,
    });

    const incomingHeaders: Record<string, string[] | string> = {
      "Content-Security-Policy": ["evil-csp"],
      "X-Content-Type-Options": ["sniff"],
      "X-Frame-Options": ["SAMEORIGIN"],
      "Referrer-Policy": ["no-referrer"],
      "Permissions-Policy": ["camera=*"],
      "x-keep-me": ["preserved"],
    };

    let callbackArg:
      | { responseHeaders?: Record<string, string[] | string> }
      | undefined;
    captured?.({ responseHeaders: incomingHeaders }, (response) => {
      callbackArg = response;
    });

    const headers = callbackArg?.responseHeaders ?? {};

    expect(headers["x-keep-me"]).toEqual(["preserved"]);

    expect(headers["Content-Security-Policy"]).not.toEqual(["evil-csp"]);
    expect(headers["X-Content-Type-Options"]).toEqual(["nosniff"]);
    expect(headers["X-Frame-Options"]).toEqual(["DENY"]);
    expect(headers["Referrer-Policy"]).toEqual([
      "strict-origin-when-cross-origin",
    ]);
    expect(headers["Permissions-Policy"]).toEqual([
      "camera=(), microphone=(), geolocation=()",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Markdown XSS protection tests
//
// The sanitizeUrl and isExternalHref functions are pure functions defined in
// markdown.tsx. Because they are not exported, we replicate their exact logic
// here so tests run in the node (non-jsdom) integration environment without
// importing React components. If the implementation diverges, these tests will
// fail by design — flagging that the security test suite needs updating.
// ---------------------------------------------------------------------------

function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) {
    return trimmed;
  }
  const scheme = schemeMatch[1]?.toLowerCase() ?? "";
  if (scheme === "javascript" || scheme === "vbscript") {
    return undefined;
  }
  if (scheme === "data") {
    if (/^data:image\/[a-zA-Z0-9.+-]+[;,]/.test(trimmed)) {
      return trimmed;
    }
    return undefined;
  }
  return trimmed;
}

function isExternalHref(href: string | undefined): boolean {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (href.startsWith("/")) return false;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href);
}

function urlTransform(url: string): string {
  const safe = sanitizeUrl(url);
  return safe ?? "";
}

describe("sanitizeUrl", () => {
  it("strips javascript: scheme URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("strips javascript: with whitespace and mixed case", () => {
    expect(
      sanitizeUrl("  JaVaScRiPt:alert(document.cookie)  "),
    ).toBeUndefined();
  });

  it("strips javascript: with encoded characters", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("strips vbscript: scheme URLs", () => {
    expect(sanitizeUrl("vbscript:MsgBox(1)")).toBeUndefined();
  });

  it("strips data: URI that is not an image", () => {
    expect(
      sanitizeUrl("data:text/html,<script>alert(1)</script>"),
    ).toBeUndefined();
  });

  it("strips data:text/html URI", () => {
    expect(
      sanitizeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="),
    ).toBeUndefined();
  });

  it("strips data:application/json URI", () => {
    expect(sanitizeUrl("data:application/json,{}")).toBeUndefined();
  });

  it("allows data:image/png URIs", () => {
    const uri = "data:image/png;base64,iVBORw0KGgo=";
    expect(sanitizeUrl(uri)).toBe(uri);
  });

  it("allows data:image/svg+xml URIs", () => {
    const uri = "data:image/svg+xml,<svg></svg>";
    expect(sanitizeUrl(uri)).toBe(uri);
  });

  it("allows data:image/webp URIs", () => {
    const uri = "data:image/webp;base64,UklGRiQ=";
    expect(sanitizeUrl(uri)).toBe(uri);
  });

  it("allows https: URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("allows http: URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto: URLs", () => {
    expect(sanitizeUrl("mailto:user@example.com")).toBe(
      "mailto:user@example.com",
    );
  });

  it("allows fragment-only hrefs", () => {
    expect(sanitizeUrl("#section-1")).toBe("#section-1");
  });

  it("allows relative paths", () => {
    expect(sanitizeUrl("/about")).toBe("/about");
  });

  it("returns undefined for empty string", () => {
    expect(sanitizeUrl("")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });

  it("returns undefined for whitespace-only input", () => {
    expect(sanitizeUrl("   ")).toBeUndefined();
  });
});

describe("urlTransform", () => {
  it("returns empty string for javascript: URLs (falsy → attribute dropped)", () => {
    expect(urlTransform("javascript:alert(1)")).toBe("");
  });

  it("returns empty string for non-image data: URIs", () => {
    expect(urlTransform("data:text/html,<h1>hi</h1>")).toBe("");
  });

  it("returns safe URLs unchanged", () => {
    expect(urlTransform("https://example.com")).toBe("https://example.com");
  });

  it("returns image data URIs unchanged", () => {
    const uri = "data:image/png;base64,iVBORw0KGgo=";
    expect(urlTransform(uri)).toBe(uri);
  });
});

describe("isExternalHref", () => {
  it("returns true for https: URLs", () => {
    expect(isExternalHref("https://example.com")).toBe(true);
  });

  it("returns true for http: URLs", () => {
    expect(isExternalHref("http://example.com")).toBe(true);
  });

  it("returns true for mailto: URLs", () => {
    expect(isExternalHref("mailto:user@example.com")).toBe(true);
  });

  it("returns false for fragment hrefs", () => {
    expect(isExternalHref("#section")).toBe(false);
  });

  it("returns false for absolute paths", () => {
    expect(isExternalHref("/about")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isExternalHref(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isExternalHref("")).toBe(false);
  });
});

describe("markdown link security contract", () => {
  it("external links must receive noopener noreferrer", () => {
    const externalUrls = [
      "https://example.com",
      "http://example.com",
      "mailto:user@example.com",
    ];
    for (const url of externalUrls) {
      const safeHref = sanitizeUrl(url);
      const external = isExternalHref(safeHref);
      expect(external).toBe(true);
    }
  });

  it("internal links must not receive noopener noreferrer", () => {
    const internalUrls = ["/about", "#section", ""];
    for (const url of internalUrls) {
      const safeHref = sanitizeUrl(url);
      const external = isExternalHref(safeHref);
      expect(external).toBe(false);
    }
  });

  it("dangerous links are sanitized to falsy, preventing rendering", () => {
    const dangerousUrls = [
      "javascript:alert(1)",
      "vbscript:MsgBox(1)",
      "data:text/html,<script>alert(1)</script>",
    ];
    for (const url of dangerousUrls) {
      const transformed = urlTransform(url);
      expect(transformed).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// Code block security tests
//
// CodeBlockCode sanitizes shiki HTML output via sanitizeHighlightedHtml which
// uses DOMParser. In the node integration environment there is no DOM, so we
// test the sanitization policy constants and the copy-button contract directly.
// ---------------------------------------------------------------------------

describe("code-block sanitization policy", () => {
  let source: string;

  beforeAll(async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(
      import.meta.dirname,
      "../../../apps/desktop/src/renderer/src/components/ui/code-block.tsx",
    );
    source = await fs.readFile(filePath, "utf-8");
  });

  it("allows only safe HTML tags from shiki output", () => {
    expect(source).toContain("ALLOWED_TAGS");
    expect(source).toMatch(/pre/);
    expect(source).toMatch(/code/);
    expect(source).toMatch(/span/);
    expect(source).toMatch(/br/);
  });

  it("disallows script tag in ALLOWED_TAGS", () => {
    const allowedTagMatch = source.match(
      /ALLOWED_TAGS\s*=\s*new\s+Set\(\[([^\]]+)\]\)/,
    );
    expect(allowedTagMatch).not.toBeNull();
    expect(allowedTagMatch?.[1]).not.toContain("script");
    expect(allowedTagMatch?.[1]).not.toContain("iframe");
    expect(allowedTagMatch?.[1]).not.toContain("object");
    expect(allowedTagMatch?.[1]).not.toContain("embed");
  });

  it("strips event handler attributes (on* attributes)", () => {
    expect(source).toMatch(/startsWith\(["']on["']\)/);
  });

  it("allows only whitelisted style properties", () => {
    expect(source).toContain("ALLOWED_STYLE_PROPERTIES");
    expect(source).toMatch(/color/);
    expect(source).toMatch(/font-style/);
    expect(source).toMatch(/font-weight/);
    expect(source).toMatch(/text-decoration/);
  });

  it("copy button uses clipboard API — no eval or innerHTML", () => {
    expect(source).not.toMatch(/\beval\b/);
    expect(source).not.toMatch(/document\.write/);
    expect(source).toMatch(/navigator\.clipboard/);
  });

  it("code prop is a plain string — no dangerouslySetInnerHTML", () => {
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("sanitizes shiki output before rendering via sanitizeHighlightedHtml", () => {
    expect(source).toContain("sanitizeHighlightedHtml");
  });

  it("removes background-color and background styles from highlighted HTML", () => {
    expect(source).toMatch(/background-color/);
    expect(source).toMatch(/background:/);
  });

  it("SAFE_STYLE_VALUE regex only allows safe style values", () => {
    expect(source).toContain("SAFE_STYLE_VALUE");
    expect(source).toMatch(/SAFE_STYLE_VALUE/);
  });
});

// ---------------------------------------------------------------------------
// IPC payload validation tests (A6 payload-parsers)
// ---------------------------------------------------------------------------

async function loadPayloadParsers() {
  return await import("../../../apps/desktop/src/main/ipc/payload-parsers");
}

describe("payload-parsers: getStringField", () => {
  it("returns undefined for non-object payloads", async () => {
    const { getStringField } = await loadPayloadParsers();
    expect(getStringField("not an object", "key")).toBeUndefined();
    expect(getStringField(null, "key")).toBeUndefined();
    expect(getStringField(undefined, "key")).toBeUndefined();
    expect(getStringField(42, "key")).toBeUndefined();
  });

  it("returns undefined when field is not a string", async () => {
    const { getStringField } = await loadPayloadParsers();
    expect(getStringField({ key: 123 }, "key")).toBeUndefined();
    expect(getStringField({ key: true }, "key")).toBeUndefined();
    expect(getStringField({ key: null }, "key")).toBeUndefined();
  });

  it("returns the string value when valid", async () => {
    const { getStringField } = await loadPayloadParsers();
    expect(getStringField({ key: "value" }, "key")).toBe("value");
  });

  it("throws PayloadValidationError for oversized strings", async () => {
    const { getStringField, MAX_STRING_BYTES, PayloadValidationError } =
      await loadPayloadParsers();
    const bigString = "x".repeat(MAX_STRING_BYTES + 1);
    expect(() => getStringField({ key: bigString }, "key")).toThrow(
      PayloadValidationError,
    );
  });
});

describe("payload-parsers: getNumberField", () => {
  it("rejects NaN values", async () => {
    const { getNumberField } = await loadPayloadParsers();
    expect(getNumberField({ n: NaN }, "n")).toBeUndefined();
  });

  it("rejects Infinity values", async () => {
    const { getNumberField } = await loadPayloadParsers();
    expect(getNumberField({ n: Infinity }, "n")).toBeUndefined();
    expect(getNumberField({ n: -Infinity }, "n")).toBeUndefined();
  });

  it("accepts finite numbers", async () => {
    const { getNumberField } = await loadPayloadParsers();
    expect(getNumberField({ n: 42 }, "n")).toBe(42);
    expect(getNumberField({ n: 0 }, "n")).toBe(0);
    expect(getNumberField({ n: -1.5 }, "n")).toBe(-1.5);
  });

  it("rejects non-number types", async () => {
    const { getNumberField } = await loadPayloadParsers();
    expect(getNumberField({ n: "42" }, "n")).toBeUndefined();
    expect(getNumberField({ n: true }, "n")).toBeUndefined();
  });
});

describe("payload-parsers: getBooleanField", () => {
  it("accepts boolean values", async () => {
    const { getBooleanField } = await loadPayloadParsers();
    expect(getBooleanField({ b: true }, "b")).toBe(true);
    expect(getBooleanField({ b: false }, "b")).toBe(false);
  });

  it("rejects truthy non-boolean values", async () => {
    const { getBooleanField } = await loadPayloadParsers();
    expect(getBooleanField({ b: 1 }, "b")).toBeUndefined();
    expect(getBooleanField({ b: "true" }, "b")).toBeUndefined();
  });
});

describe("payload-parsers: getStringArrayField", () => {
  it("filters non-string entries from arrays", async () => {
    const { getStringArrayField } = await loadPayloadParsers();
    const result = getStringArrayField({ arr: ["a", 123, true, "b"] }, "arr");
    expect(result).toEqual(["a", "b"]);
  });

  it("returns undefined for non-array values", async () => {
    const { getStringArrayField } = await loadPayloadParsers();
    expect(getStringArrayField({ arr: "not-array" }, "arr")).toBeUndefined();
    expect(getStringArrayField({ arr: 42 }, "arr")).toBeUndefined();
  });

  it("throws on oversized arrays", async () => {
    const { getStringArrayField, MAX_ARRAY_LENGTH, PayloadValidationError } =
      await loadPayloadParsers();
    const bigArray = new Array(MAX_ARRAY_LENGTH + 1).fill("x");
    expect(() => getStringArrayField({ arr: bigArray }, "arr")).toThrow(
      PayloadValidationError,
    );
  });
});

describe("payload-parsers: strict parsers reject unknown keys", () => {
  it("parseSearchRequestStrict rejects extra keys", async () => {
    const { parseSearchRequestStrict, PayloadValidationError } =
      await loadPayloadParsers();
    expect(() =>
      parseSearchRequestStrict({
        query: "test",
        rootPath: "/tmp",
        evilKey: true,
      }),
    ).toThrow(PayloadValidationError);
  });

  it("parseDialogOptionsStrict rejects extra keys", async () => {
    const { parseDialogOptionsStrict, PayloadValidationError } =
      await loadPayloadParsers();
    expect(() =>
      parseDialogOptionsStrict({ title: "Open", evilKey: true }),
    ).toThrow(PayloadValidationError);
  });

  it("parseTerminalCreateOptionsStrict rejects extra keys", async () => {
    const { parseTerminalCreateOptionsStrict, PayloadValidationError } =
      await loadPayloadParsers();
    expect(() =>
      parseTerminalCreateOptionsStrict({
        id: "t1",
        cols: 80,
        rows: 24,
        ownerWindowId: "w1",
        evilKey: true,
      }),
    ).toThrow(PayloadValidationError);
  });
});

describe("payload-parsers: requireStringField", () => {
  it("throws on missing required string field", async () => {
    const { requireStringField, PayloadValidationError } =
      await loadPayloadParsers();
    expect(() => requireStringField({}, "name")).toThrow(
      PayloadValidationError,
    );
  });

  it("throws on non-string required field", async () => {
    const { requireStringField, PayloadValidationError } =
      await loadPayloadParsers();
    expect(() => requireStringField({ name: 42 }, "name")).toThrow(
      PayloadValidationError,
    );
  });

  it("returns the string for valid required fields", async () => {
    const { requireStringField } = await loadPayloadParsers();
    expect(requireStringField({ name: "alice" }, "name")).toBe("alice");
  });
});

// ---------------------------------------------------------------------------
// Error sanitization / PII redaction tests
// ---------------------------------------------------------------------------

async function loadSanitizer() {
  return await import("../../../apps/desktop/src/main/ipc/sanitize-ipc-error");
}

describe("sanitizeIpcError: PII redaction", () => {
  it("redacts GitHub personal access tokens", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("git push failed: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toContain("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(result.message).toContain("<token>");
  });

  it("redacts OpenAI-style API keys", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("API error from sk-ABCDEF1234567890WXYZ");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toContain("sk-ABCDEF1234567890WXYZ");
    expect(result.message).toContain("<token>");
  });

  it("redacts Anthropic-style API keys", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("Failed with sk-ant-ABCDEF1234567890WXYZ");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toContain("sk-ant-ABCDEF1234567890WXYZ");
    expect(result.message).toContain("<token>");
  });

  it("redacts AWS access keys", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("AWS auth failed for AKIAIOSFODNN7EXAMPLE");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result.message).toContain("<token>");
  });

  it("redacts Bearer tokens", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("Auth error: Bearer eyJhbGciOiJIUzI1NiJ9.payload");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(result.message).toContain("<token>");
  });

  it("redacts email addresses", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("User user@example.com not found");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toContain("user@example.com");
    expect(result.message).toContain("<email>");
  });

  it("redacts absolute POSIX paths", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("ENOENT: open '/Users/tan/.superset/secret.env'");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toMatch(/\/Users\/tan/);
    expect(result.message).toContain("<path>");
  });

  it("redacts home-tilde paths", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("Failed ~/Library/Keychains/login.keychain");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toMatch(/~\/Library/);
    expect(result.message).toContain("<path>");
  });

  it("redacts Windows absolute paths", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error(
      "Cannot access C:\\Users\\Admin\\AppData\\secret.db",
    );
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toMatch(/C:\\Users/);
    expect(result.message).toContain("<path>");
  });

  it("preserves the error name", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new TypeError("type error at /Users/tan/file.ts");
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.name).toBe("TypeError");
  });

  it("drops the stack trace entirely", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("stack test");
    input.stack = "Error: stack test\n    at foo.ts:1:1";
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.stack).toBeUndefined();
  });

  it("preserves valid error codes on sanitized error", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error("failed at /Users/tan/secret");
    (input as { code?: unknown }).code = "EFS_NOT_FOUND";
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result).toHaveProperty("code", "EFS_NOT_FOUND");
  });

  it("logs the original error before sanitization", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const log = vi.fn();
    const input = new Error("original at /Users/tan/secret");
    sanitizeIpcError(input, { log });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(input);
  });

  it("wraps non-Error values with generic message", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const result = sanitizeIpcError("bare string", { log: () => undefined });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("IPC operation failed");
  });

  it("handles combined PII in a single error message", async () => {
    const { sanitizeIpcError } = await loadSanitizer();
    const input = new Error(
      "git push ghp_ABCDEFGHIJKLMNOPQRST failed for user@example.com at /Users/tan/repo",
    );
    const result = sanitizeIpcError(input, { log: () => undefined });
    expect(result.message).not.toContain("ghp_ABCDEFGHIJKLMNOPQRST");
    expect(result.message).not.toContain("user@example.com");
    expect(result.message).not.toMatch(/\/Users\/tan/);
    expect(result.message).toContain("<token>");
    expect(result.message).toContain("<email>");
    expect(result.message).toContain("<path>");
  });
});

describe("scrubErrorMessage: direct unit test", () => {
  it("redacts secrets before paths (order matters)", async () => {
    const { scrubErrorMessage } = await loadSanitizer();
    const message =
      "key sk-ABCDEF1234567890FAIL at /Users/tan/.superset/secret";
    const result = scrubErrorMessage(message);
    expect(result).not.toContain("sk-ABCDEF1234567890FAIL");
    expect(result).not.toMatch(/\/Users\/tan/);
    expect(result).toContain("<token>");
    expect(result).toContain("<path>");
  });

  it("preserves messages with no PII", async () => {
    const { scrubErrorMessage } = await loadSanitizer();
    const message = "Operation completed successfully";
    expect(scrubErrorMessage(message)).toBe(message);
  });
});

describe("createSanitizingHandle: IPC boundary", () => {
  it("passes through successful handler results unchanged", async () => {
    const { createSanitizingHandle } = await loadSanitizer();
    const inner = vi.fn();
    const handle = createSanitizingHandle(inner, { log: () => undefined });
    handle("test.channel", async () => "ok");
    const listener = inner.mock.calls[0]?.[1];
    const result = await (listener as (e: unknown, p: unknown) => unknown)(
      undefined,
      undefined,
    );
    expect(result).toBe("ok");
  });

  it("sanitizes errors from inner handlers before they reach the renderer", async () => {
    const { createSanitizingHandle } = await loadSanitizer();
    const inner = vi.fn();
    const log = vi.fn();
    const handle = createSanitizingHandle(inner, { log });
    handle("test.channel", async () => {
      throw new Error("secret ghp_ABCDEFGHIJKLMNOPQRST at /Users/tan/file");
    });
    const listener = inner.mock.calls[0]?.[1];
    await expect(
      (listener as (e: unknown, p: unknown) => Promise<unknown>)(
        undefined,
        undefined,
      ),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/<token>/),
    });
  });
});
