"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

// Skip highlighting for files larger than this (50KB)
const MAX_HIGHLIGHT_SIZE = 50 * 1024;

// Debounce highlighting to not block the main thread
const HIGHLIGHT_DEBOUNCE_MS = 50;

// Allowed HTML tags from shiki output
const ALLOWED_TAGS = new Set(["pre", "code", "span", "br"]);

// Allowed attributes
const ALLOWED_ATTRIBUTES = new Set([
  "class",
  "style",
  "tabindex",
  "aria-hidden",
]);

// Style properties we allow (removed background-color to let app theme show through)
const ALLOWED_STYLE_PROPERTIES = new Set([
  "color",
  "font-style",
  "font-weight",
  "text-decoration",
]);

const SAFE_STYLE_VALUE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|var\(--[\w-]+\)|transparent|inherit|initial|normal|italic|oblique|underline|none|bold|[1-9]00)$/;

function sanitizeStyleAttribute(value: string): string | null {
  const safeDeclarations: string[] = [];

  for (const declaration of value.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");

    if (!rawProperty || rawValueParts.length === 0) {
      continue;
    }

    const property = rawProperty.trim().toLowerCase();
    const styleValue = rawValueParts.join(":").trim();

    if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
      continue;
    }

    if (!SAFE_STYLE_VALUE.test(styleValue)) {
      continue;
    }

    safeDeclarations.push(`${property}: ${styleValue}`);
  }

  return safeDeclarations.length > 0 ? safeDeclarations.join("; ") : null;
}

function sanitizeHighlightedHtml(html: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const elements = Array.from(doc.body.querySelectorAll("*"));

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();

        if (name.startsWith("on")) {
          element.removeAttribute(attribute.name);
          continue;
        }

        if (name === "style") {
          // Remove background-color styles to let app theme show through
          let styleValue = attribute.value;
          styleValue = styleValue.replace(/background-color:[^;]+;?/gi, "");
          styleValue = styleValue.replace(/background:[^;]+;?/gi, "");
          styleValue = styleValue.trim();

          if (styleValue) {
            const safeStyle = sanitizeStyleAttribute(styleValue);
            if (safeStyle) {
              element.setAttribute("style", safeStyle);
            } else {
              element.removeAttribute(attribute.name);
            }
          } else {
            element.removeAttribute(attribute.name);
          }
          continue;
        }

        if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith("data-")) {
          element.removeAttribute(attribute.name);
        }
      }
    }

    return doc.body.innerHTML;
  } catch {
    return null;
  }
}

type SafeInlineStyle = {
  color?: string;
  fontStyle?: "normal" | "italic" | "oblique";
  fontWeight?: string | number;
  textDecoration?: string;
};

function parseSafeInlineStyle(value: string): SafeInlineStyle | undefined {
  const style: SafeInlineStyle = {};

  for (const declaration of value.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    if (!rawProperty || rawValueParts.length === 0) {
      continue;
    }

    const property = rawProperty.trim().toLowerCase();
    const styleValue = rawValueParts.join(":").trim();
    if (!styleValue) {
      continue;
    }

    if (property === "color") {
      style.color = styleValue;
      continue;
    }

    if (
      property === "font-style" &&
      (styleValue === "normal" ||
        styleValue === "italic" ||
        styleValue === "oblique")
    ) {
      style.fontStyle = styleValue;
      continue;
    }

    if (property === "font-weight") {
      style.fontWeight = /^\d+$/.test(styleValue)
        ? Number(styleValue)
        : styleValue;
      continue;
    }

    if (property === "text-decoration") {
      style.textDecoration = styleValue;
    }
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function renderHighlightedNode(
  node: ChildNode,
  key: string,
): React.ReactNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (!(node instanceof HTMLElement)) {
    return null;
  }

  const className = node.getAttribute("class") ?? undefined;
  const tabIndexValue = node.getAttribute("tabindex");
  const tabIndex = tabIndexValue
    ? Number.parseInt(tabIndexValue, 10)
    : undefined;
  const ariaHiddenValue = node.getAttribute("aria-hidden");
  const ariaHidden = ariaHiddenValue === "true" ? true : undefined;
  const style = parseSafeInlineStyle(node.getAttribute("style") ?? "");
  const children = Array.from(node.childNodes)
    .map((child, index) => renderHighlightedNode(child, `${key}-${index}`))
    .filter((child) => child !== null);

  if (node.tagName.toLowerCase() === "pre") {
    return (
      <pre
        key={key}
        className={className}
        tabIndex={tabIndex}
        aria-hidden={ariaHidden}
        style={style}
      >
        {children}
      </pre>
    );
  }

  if (node.tagName.toLowerCase() === "code") {
    return (
      <code
        key={key}
        className={className}
        tabIndex={tabIndex}
        aria-hidden={ariaHidden}
        style={style}
      >
        {children}
      </code>
    );
  }

  if (node.tagName.toLowerCase() === "span") {
    return (
      <span
        key={key}
        className={className}
        tabIndex={tabIndex}
        aria-hidden={ariaHidden}
        style={style}
      >
        {children}
      </span>
    );
  }

  if (node.tagName.toLowerCase() === "br") {
    return <br key={key} />;
  }

  return null;
}

function renderHighlightedHtml(html: string): React.ReactNode[] | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    return Array.from(doc.body.childNodes)
      .map((node, index) => renderHighlightedNode(node, `highlight-${index}`))
      .filter((node) => node !== null);
  } catch {
    return null;
  }
}

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col",
        "transition-all duration-[var(--duration-fast)] ease-out",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type CodeBlockCodeProps = {
  code: string;
  language?: string;
  theme?: string;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-dark",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [isTooLarge, setIsTooLarge] = useState(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const highlightedContent = useMemo(
    () =>
      highlightedHtml
        ? renderHighlightedHtml(highlightedHtml)
        : highlightedHtml,
    [highlightedHtml],
  );

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const runHighlight = useCallback(async () => {
    if (!code || !isMountedRef.current) return;

    // Skip highlighting for large files
    if (code.length > MAX_HIGHLIGHT_SIZE) {
      setIsTooLarge(true);
      setIsHighlighting(false);
      return;
    }

    setIsHighlighting(true);

    try {
      const html = await codeToHtml(code, {
        lang: language,
        theme,
      });
      if (isMountedRef.current) {
        setHighlightedHtml(sanitizeHighlightedHtml(html));
      }
    } catch {
      // Fallback to plain text on error
      if (isMountedRef.current) {
        setHighlightedHtml(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsHighlighting(false);
      }
    }
  }, [code, language, theme]);

  useEffect(() => {
    // Reset state when code changes
    setHighlightedHtml(null);
    setIsTooLarge(false);
    setIsHighlighting(false);

    if (!code) {
      setHighlightedHtml("<pre><code></code></pre>");
      return;
    }

    // Debounce highlighting to not block the main thread
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      void runHighlight();
    }, HIGHLIGHT_DEBOUNCE_MS);
  }, [code, runHighlight]);

  const classNames = cn(
    "relative w-full overflow-x-auto rounded-lg border border-white/[0.04] bg-[#111111] font-mono text-[16px] leading-relaxed",
    className,
  );

  // If file is too large, show plain text with a notice
  if (isTooLarge) {
    return (
      <div className={classNames} {...props}>
        <div
          className={cn(
            "sticky top-0 z-10 border-b border-white/[0.04] bg-white/[0.02] px-4 py-2 text-xs text-white/20 backdrop-blur",
            "transition-all duration-[var(--duration-fast)] ease-out",
          )}
        >
          File too large for syntax highlighting
        </div>
        <div className="p-4">
          <pre className="whitespace-pre-wrap break-words">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    );
  }

  // Show plain text immediately while highlighting loads
  return (
    <div className={classNames} {...props}>
      {isHighlighting && (
        <div
          className={cn(
            "sticky top-0 z-10 border-b border-white/[0.04] bg-white/[0.02] px-4 py-2 text-xs text-white/20 backdrop-blur",
            "transition-all duration-[var(--duration-fast)] ease-out",
          )}
        >
          Loading syntax highlighting...
        </div>
      )}
      {highlightedContent ? (
        <div className="p-4 transition-opacity duration-[var(--duration-fast)] ease-out">
          {highlightedContent}
        </div>
      ) : (
        <div className="p-4 transition-opacity duration-[var(--duration-fast)] ease-out">
          <pre className="whitespace-pre-wrap break-words">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>;

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "transition-all duration-[var(--duration-fast)] ease-out",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { CodeBlock, CodeBlockCode, CodeBlockGroup };
