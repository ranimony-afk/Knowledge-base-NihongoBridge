"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "ruby", "rt", "rp"],
  attributes: {
    ...defaultSchema.attributes,
    ruby: ["lang"],
    span: [...(defaultSchema.attributes?.span ?? []), "lang", "className"],
  },
};

const components: Components = {
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold text-sumi dark:text-washi">{children}</strong>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-vermilion underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-sumi/[0.06] px-1 py-0.5 font-mono text-[0.88em] dark:bg-white/10">
      {children}
    </code>
  ),
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="jp-text tutor-markdown text-[0.92rem] leading-[1.75] text-sumi/80 dark:text-washi/80">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
