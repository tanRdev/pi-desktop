"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

const ALLOWED_TAGS = new Set(["pre", "code", "span", "br"]);
const ALLOWED_ATTRIBUTES = new Set([
  "class",
  "style",
  "tabindex",
  "aria-hidden",
]);
const ALLOWED_STYLE_PROPERTIES = new Set([
  "background-color",
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
          const safeStyle = sanitizeStyleAttribute(attribute.value);

          if (safeStyle) {
            element.setAttribute("style", safeStyle);
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

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-border bg-card text-card-foreground rounded-xl",
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
  theme = "github-light",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>");
        return;
      }

      const html = await codeToHtml(code, { lang: language, theme });
      setHighlightedHtml(sanitizeHighlightedHtml(html));
    }
    highlight();
  }, [code, language, theme]);

  useEffect(() => {
    if (containerRef.current && highlightedHtml) {
      containerRef.current.innerHTML = highlightedHtml;
    }
  }, [highlightedHtml]);

  const classNames = cn(
    "w-full overflow-x-auto text-[13px] [&>pre]:px-4 [&>pre]:py-4",
    className,
  );

  // SSR fallback: render plain code if not hydrated yet
  return highlightedHtml ? (
    <div ref={containerRef} className={classNames} {...props} />
  ) : (
    <div className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
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
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock };
