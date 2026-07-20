"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer for chat content (assistant answers + thinking). Each element
 * maps to Tailwind classes tuned for the midnight theme — no typography plugin
 * needed. `muted` renders smaller/dimmer text for the collapsible thinking block.
 */
const components: Components = {
  h1: ({ children }) => <h1 className="mb-1.5 mt-2 text-[15px] font-bold text-chalk">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 mt-2 text-[14px] font-bold text-chalk">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-[13px] font-semibold text-chalk">{children}</h3>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-chalk">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-shine">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:text-chalk-dim">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-shine underline underline-offset-2 hover:text-shine-soft">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const inline = !className;
    return inline ? (
      <code className="rounded bg-night px-1 py-0.5 font-mono text-[12px] text-shine">{children}</code>
    ) : (
      <code className={`${className ?? ""} font-mono text-[12px]`}>{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="scroll-thin my-2 overflow-x-auto rounded-md border border-night-edge bg-night p-3 text-[12px] leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-night-edge pl-3 text-chalk-dim">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="scroll-thin my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-night-edge bg-night px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-night-edge px-2 py-1">{children}</td>,
  hr: () => <hr className="my-3 border-night-edge" />,
};

function Markdown({ children, muted }: { children: string; muted?: boolean }) {
  return (
    <div className={muted ? "text-[12px] text-chalk-dim" : "text-[14px] text-chalk"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

// Parsing markdown (react-markdown + remark-gfm) is expensive and both props
// are primitives; without memo, every ChatPanel re-render (each keystroke,
// each stream chunk) re-parses the ENTIRE transcript — long chats turn that
// into constant CPU/GC pressure.
export default memo(Markdown);
