import { marked } from "marked";
import { memo, useId, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CodeBlockCode } from "./code-block";

export type MarkdownProps = {
  children: string;
  id?: string;
  className?: string;
  components?: Partial<Components>;
};

type MarkdownBlock = {
  content: string;
  key: string;
};

function parseMarkdownIntoBlocks(markdown: string): MarkdownBlock[] {
  const tokens = marked.lexer(markdown);
  let offset = 0;

  return tokens.map((token) => {
    const raw = token.raw ?? "";
    const block = {
      content: raw,
      key: `${token.type}-${offset}`,
    };

    offset += raw.length;

    return block;
  });
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext";
  const match = className.match(/language-(\w+)/);
  const language = match?.[1];
  return language ?? "plaintext";
}

const INITIAL_COMPONENTS: Partial<Components> = {
  h1: function H1Component({ children, ...props }) {
    return (
      <h1
        className="mt-8 mb-4 text-2xl font-sans font-normal tracking-tight text-white/90"
        {...props}
      >
        {children}
      </h1>
    );
  },
  h2: function H2Component({ children, ...props }) {
    return (
      <h2
        className="mt-8 mb-4 text-xl font-sans font-normal tracking-tight text-white/90"
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3: function H3Component({ children, ...props }) {
    return (
      <h3
        className="mt-6 mb-3 text-lg font-sans font-normal tracking-tight text-white/90"
        {...props}
      >
        {children}
      </h3>
    );
  },
  h4: function H4Component({ children, ...props }) {
    return (
      <h4
        className="mt-6 mb-2 text-base font-sans font-normal tracking-tight text-white/90"
        {...props}
      >
        {children}
      </h4>
    );
  },
  h5: function H5Component({ children, ...props }) {
    return (
      <h5
        className="mt-4 mb-2 text-sm font-normal uppercase tracking-wide text-white/50"
        {...props}
      >
        {children}
      </h5>
    );
  },
  h6: function H6Component({ children, ...props }) {
    return (
      <h6
        className="mt-4 mb-2 text-xs font-normal uppercase tracking-wide text-white/50"
        {...props}
      >
        {children}
      </h6>
    );
  },
  p: function PComponent({ children, ...props }) {
    return (
      <p className="my-4 text-sm leading-7 text-white/70" {...props}>
        {children}
      </p>
    );
  },
  a: function AComponent({ children, href, ...props }) {
    return (
      <a
        href={href}
        onClick={(event) => {
          if (!href) {
            return;
          }

          event.preventDefault();
          void window.piDesktop.dialog.openExternal(href);
        }}
        className={cn(
          "text-sm text-[var(--color-accent)]/80 underline underline-offset-4 decoration-[var(--color-accent)]/30",
          "transition-all duration-150 ease-out",
          "hover:decoration-[var(--color-accent)]/60 hover:text-[var(--color-accent)]",
        )}
        {...props}
      >
        {children}
      </a>
    );
  },
  strong: function StrongComponent({ children, ...props }) {
    return (
      <strong className="font-normal text-white/80" {...props}>
        {children}
      </strong>
    );
  },
  em: function EmComponent({ children, ...props }) {
    return (
      <em className="italic text-white/60" {...props}>
        {children}
      </em>
    );
  },
  del: function DelComponent({ children, ...props }) {
    return (
      <del className="line-through text-white/30" {...props}>
        {children}
      </del>
    );
  },
  hr: function HrComponent() {
    return (
      <hr
        className={cn(
          "my-8 border-t border-white/[0.06]",
          "transition-colors duration-150 ease-out",
        )}
      />
    );
  },
  br: function BrComponent() {
    return <br className="block content-['']" />;
  },
  ul: function UlComponent({ children, ...props }) {
    return (
      <ul
        className="my-4 ml-6 list-none text-sm leading-7 text-white/70"
        {...props}
      >
        {children}
      </ul>
    );
  },
  ol: function OlComponent({ children, ...props }) {
    return (
      <ol
        className="my-4 ml-6 list-decimal text-sm leading-7 text-white/70"
        {...props}
      >
        {children}
      </ol>
    );
  },
  li: function LiComponent({ children, ...props }) {
    return (
      <li className="my-1.5 pl-1 flex items-start gap-2" {...props}>
        <span className="text-white/20 mt-1.5 size-1 bg-current shrink-0" />
        <div>{children}</div>
      </li>
    );
  },
  blockquote: function BlockquoteComponent({ children, ...props }) {
    return (
      <blockquote
        className={cn(
          "my-6 border-l-2 border-white/[0.08] pl-4 italic text-white/50",
          "transition-all duration-150 ease-out",
          "hover:border-white/[0.15]",
        )}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return (
        <code
          className={cn(
            "bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs",
            "text-white/80",
            "transition-all duration-150 ease-out",
            "hover:bg-white/[0.09]",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    const language = extractLanguage(className);

    return (
      <CodeBlockCode
        code={children as string}
        language={language}
        className="my-6"
      />
    );
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>;
  },
  table: function TableComponent({ children, ...props }) {
    return (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    );
  },
  thead: function TheadComponent({ children, ...props }) {
    return (
      <thead
        className="border-b border-white/[0.06] bg-white/[0.02]"
        {...props}
      >
        {children}
      </thead>
    );
  },
  tbody: function TbodyComponent({ children, ...props }) {
    return (
      <tbody className="divide-y divide-white/[0.04]" {...props}>
        {children}
      </tbody>
    );
  },
  tr: function TrComponent({ children, ...props }) {
    return (
      <tr
        className={cn(
          "transition-all duration-150 ease-out",
          "hover:bg-white/[0.02]",
        )}
        {...props}
      >
        {children}
      </tr>
    );
  },
  th: function ThComponent({ children, ...props }) {
    return (
      <th
        className="px-3 py-2 text-left text-xs font-normal uppercase tracking-wide text-white/40"
        {...props}
      >
        {children}
      </th>
    );
  },
  td: function TdComponent({ children, ...props }) {
    return (
      <td className="px-3 py-2 text-sm text-white/60" {...props}>
        {children}
      </td>
    );
  },
  img: function ImgComponent({ src, alt, ...props }) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          "my-6 border border-white/[0.06] max-w-full",
          "transition-all duration-200 ease-out",
        )}
        {...props}
      />
    );
  },
};

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string;
    components?: Partial<Components>;
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content;
  },
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId();
  const blockId = id ?? generatedId;
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

  return (
    <div className={className}>
      {blocks.map((block) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-${block.key}`}
          content={block.content}
          components={components}
        />
      ))}
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = "Markdown";

export { Markdown };
