import type { Session } from "electron";

export interface BuildCspOptions {
  isDevelopment: boolean;
}

const PRODUCTION_CONNECT_SRC: ReadonlyArray<string> = [
  "'self'",
  "https://registry.npmjs.org",
  "https://cdn.jsdelivr.net",
];

const DEV_CONNECT_SRC: ReadonlyArray<string> = [
  "ws://localhost:*",
  "ws://127.0.0.1:*",
  "http://localhost:*",
  "http://127.0.0.1:*",
];

export function buildCsp({ isDevelopment }: BuildCspOptions): string {
  const connectSrc = isDevelopment
    ? [...PRODUCTION_CONNECT_SRC, ...DEV_CONNECT_SRC]
    : PRODUCTION_CONNECT_SRC;

  const scriptSrc = isDevelopment
    ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
    : ["'self'"];

  const directives: Array<readonly [string, ReadonlyArray<string>]> = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connectSrc],
    ["media-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ];

  return directives
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function getContentSecurityPolicy(isDevelopment: boolean): string {
  return buildCsp({ isDevelopment });
}

interface SecurityHeaders {
  "Content-Security-Policy": string[];
  "X-Content-Type-Options": string[];
  "X-Frame-Options": string[];
  "Referrer-Policy": string[];
  "Permissions-Policy": string[];
}

function buildSecurityHeaders(isDevelopment: boolean): SecurityHeaders {
  return {
    "Content-Security-Policy": [buildCsp({ isDevelopment })],
    "X-Content-Type-Options": ["nosniff"],
    "X-Frame-Options": ["DENY"],
    "Referrer-Policy": ["strict-origin-when-cross-origin"],
    "Permissions-Policy": ["camera=(), microphone=(), geolocation=()"],
  };
}

const HEADER_NAMES_TO_STRIP: ReadonlySet<string> = new Set([
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
]);

export interface InstallSecurityHeadersOptions {
  session: Session;
  isDevelopment: boolean;
}

export function installSecurityHeaders({
  session,
  isDevelopment,
}: InstallSecurityHeadersOptions): void {
  const securityHeaders = buildSecurityHeaders(isDevelopment);

  session.webRequest.onHeadersReceived((details, callback) => {
    const existingHeaders = details.responseHeaders ?? {};
    const nextHeaders: Record<string, string[] | string> = {};

    for (const [name, value] of Object.entries(existingHeaders)) {
      if (HEADER_NAMES_TO_STRIP.has(name.toLowerCase())) {
        continue;
      }
      nextHeaders[name] = value;
    }

    for (const [name, value] of Object.entries(securityHeaders)) {
      nextHeaders[name] = value;
    }

    callback({ responseHeaders: nextHeaders });
  });
}
