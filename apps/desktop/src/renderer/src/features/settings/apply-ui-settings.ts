import type { UiSettings } from "./use-settings";

const SANS_STACKS: Record<string, string> = {
  "Geist Variable": '"Geist Variable", Geist, sans-serif',
  Geist: '"Geist Variable", Geist, sans-serif',
};

const MONO_STACKS: Record<string, string> = {
  "Geist Mono":
    '"Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  "Geist Mono Variable":
    '"Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

/**
 * Map a settings font name to a CSS font-family stack.
 * Unknown names are quoted and used as-is with a sensible fallback.
 */
export function resolveSansFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim();
  const fallback = '"Geist Variable", Geist, sans-serif';
  if (!trimmed) return fallback;
  return SANS_STACKS[trimmed] ?? `"${trimmed}", sans-serif`;
}

export function resolveMonoFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim();
  const fallback =
    '"Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  if (!trimmed) return fallback;
  return (
    MONO_STACKS[trimmed] ??
    `"${trimmed}", ui-monospace, SFMono-Regular, Menlo, monospace`
  );
}

/**
 * Apply appearance UI settings to `document.documentElement`.
 * Safe to call from React effects or outside React.
 */
export function applyUiSettingsToDocument(settings: UiSettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.setProperty(
    "--app-font-sans",
    resolveSansFontFamily(settings.fontFamily),
  );
  root.style.fontSize = `${settings.fontSize}px`;

  if (document.body) {
    document.body.style.fontSize = `${settings.fontSize}px`;
  }

  if (settings.reducedMotion) {
    root.setAttribute("data-reduced-motion", "true");
  } else {
    root.removeAttribute("data-reduced-motion");
  }
}
