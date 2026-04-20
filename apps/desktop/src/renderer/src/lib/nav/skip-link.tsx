import type { ReactElement } from "react";

export type SkipLinkProps = {
  targetId?: string;
  label?: string;
};

export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps): ReactElement {
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: "fixed",
        top: "-100px",
        left: "0",
        zIndex: 9999,
        padding: "8px 16px",
        background: "var(--color-bg, #000)",
        color: "var(--color-fg, #fff)",
        textDecoration: "none",
        fontWeight: 600,
        transition: "top 0.2s ease",
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = "0";
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = "-100px";
      }}
    >
      {label}
    </a>
  );
}
