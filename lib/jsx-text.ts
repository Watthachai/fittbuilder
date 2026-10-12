import { parse } from "@babel/parser";

/**
 * Write the `>` and `}` that sit in JSX text as entities.
 *
 * A page that quotes code or a comparison as text — `if (parsed.length > 0)`,
 * "> 90%" — is valid to Babel but not to esbuild, which compiles the preview:
 * "The character ">" is not valid inside a JSX element", and the whole app
 * stops (cases #12 and #14). A prompt rule did not hold; which characters are
 * in JSX text is a fact in the file, so the fix is ours. `&gt;` and `&#125;`
 * render as the same characters.
 *
 * Returns null when there is nothing to change, or when the file does not parse
 * — a file that is broken some other way is left to fail where it is.
 */
export function escapeJsxText(source: string): string | null {
  let program: unknown;
  try {
    program = parse(source, { sourceType: "module", plugins: ["jsx", "typescript"] }).program;
  } catch {
    return null;
  }
  const spans: [number, number][] = [];
  visit(program, (node) => {
    if (node.type === "JSXText" && /[>}]/.test(source.slice(node.start, node.end))) spans.push([node.start, node.end]);
  });
  if (spans.length === 0) return null;
  let out = source;
  // From the end, so each splice leaves the earlier offsets where they were.
  for (const [start, end] of spans.sort((a, b) => b[0] - a[0])) {
    const text = out.slice(start, end).replace(/[>}]/g, (c) => (c === ">" ? "&gt;" : "&#125;"));
    out = out.slice(0, start) + text + out.slice(end);
  }
  return out;
}

interface Located {
  type: string;
  start: number;
  end: number;
}

function visit(node: unknown, hit: (node: Located) => void): void {
  if (!node || typeof node !== "object" || typeof (node as Located).type !== "string") return;
  hit(node as Located);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) visit(child, hit);
    else visit(value, hit);
  }
}
