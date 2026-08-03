import { parseLoc } from "./wand";

/**
 * Deterministic edits for the wand's ⚡ quick mode: colour, size, spacing and
 * text are the majority of real edits, and sending them through the model costs
 * ~15s and a generation quota to change one attribute. Because `data-fitt-loc`
 * gives the exact line AND column of the opening tag, we can patch the source
 * directly and let Vite HMR show it instantly.
 *
 * Every function returns null when it cannot be certain (dynamic className,
 * non-text children, tag not found at that position) — the caller then falls
 * back to the model instead of writing a wrong edit.
 */

/** A quick action: which utilities it applies, and which it must clear first. */
export interface ClassAction {
  label: string;
  add: string[];
  /** Existing utilities matching this are removed (so bg-red-500 replaces bg-blue-500). */
  replaces: RegExp;
}

/** Byte offset of a 1-based line / 0-based column. */
function offsetOf(source: string, line: number, column: number): number | null {
  let at = 0;
  for (let i = 1; i < line; i++) {
    const nl = source.indexOf("\n", at);
    if (nl === -1) return null;
    at = nl + 1;
  }
  const offset = at + column;
  return offset <= source.length ? offset : null;
}

/** End offset (exclusive) of the opening tag that starts at `start`. */
function openingTagEnd(source: string, start: number): number | null {
  if (source[start] !== "<") return null;
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return null;
}

/** Merge `add` into `current`, dropping anything the action replaces. */
export function mergeClasses(current: string, action: ClassAction): string {
  const kept = current
    .split(/\s+/)
    .filter((c) => c && !action.replaces.test(c) && !action.add.includes(c));
  return [...kept, ...action.add].join(" ");
}

/**
 * Rewrite the className of the element at `loc`. Returns the new file contents,
 * or null when the element has no static className to patch.
 */
export function patchClassName(source: string, loc: string, action: ClassAction): string | null {
  const { line } = parseLoc(loc);
  const column = Number(loc.split(":").pop());
  const start = offsetOf(source, line, Number.isFinite(column) ? column : 0);
  if (start === null) return null;
  const end = openingTagEnd(source, start);
  if (end === null) return null;

  const tag = source.slice(start, end);
  const attr = /\sclassName\s*=\s*(["'])((?:(?!\1)[\s\S])*)\1/.exec(tag);
  if (attr) {
    const merged = mergeClasses(attr[2], action);
    const at = start + attr.index;
    return (
      source.slice(0, at) +
      ` className=${attr[1]}${merged}${attr[1]}` +
      source.slice(at + attr[0].length)
    );
  }
  // A dynamic className ({clsx(...)}, a template literal) is not safely patchable.
  if (/\sclassName\s*=\s*\{/.test(tag)) return null;
  // No className at all — add one right after the tag name.
  const name = /^<\s*[\w.-]+/.exec(tag);
  if (!name) return null;
  const at = start + name[0].length;
  return source.slice(0, at) + ` className="${action.add.join(" ")}"` + source.slice(at);
}

/**
 * Replace the plain-text children of the element at `loc`. Returns null unless
 * the children are literal text (anything with markup or an expression is left
 * to the model).
 */
export function patchText(source: string, loc: string, text: string): string | null {
  const { line } = parseLoc(loc);
  const column = Number(loc.split(":").pop());
  const start = offsetOf(source, line, Number.isFinite(column) ? column : 0);
  if (start === null) return null;
  const end = openingTagEnd(source, start);
  if (end === null) return null;
  if (source[end - 1] === "/") return null; // self-closing: no children to set

  const name = /^<\s*([\w.-]+)/.exec(source.slice(start, end));
  if (!name) return null;
  const close = source.indexOf(`</${name[1]}`, end);
  if (close === -1) return null;

  const children = source.slice(end + 1, close);
  if (/[<{}]/.test(children)) return null; // markup or an expression — hands off
  const indent = /^\s*\n(\s*)/.exec(children)?.[1];
  const body = indent ? `\n${indent}${text}\n${indent.slice(2)}` : text;
  return source.slice(0, end + 1) + body + source.slice(close);
}

/** The palette behind the ⚡ tab: small, opinionated, and conflict-aware. */
export const QUICK_COLORS: { label: string; swatch: string; bg: string; text: string }[] = [
  { label: "น้ำเงิน", swatch: "#3b82f6", bg: "bg-blue-500", text: "text-blue-600" },
  { label: "เขียว", swatch: "#22c55e", bg: "bg-green-500", text: "text-green-600" },
  { label: "แดง", swatch: "#ef4444", bg: "bg-red-500", text: "text-red-600" },
  { label: "เหลือง", swatch: "#f59e0b", bg: "bg-amber-500", text: "text-amber-600" },
  { label: "ม่วง", swatch: "#8b5cf6", bg: "bg-violet-500", text: "text-violet-600" },
  { label: "เทา", swatch: "#64748b", bg: "bg-slate-500", text: "text-slate-600" },
  { label: "ขาว", swatch: "#ffffff", bg: "bg-white", text: "text-white" },
  { label: "ดำ", swatch: "#0f172a", bg: "bg-slate-900", text: "text-slate-900" },
];

const BG_RE = /^bg-/;
// Colours carry a shade (text-red-500) or are white/black — sizes never do, so
// setting a colour must not wipe text-sm.
const TEXT_COLOR_RE = /^text-(?:\w+-\d{2,3}|white|black)$/;
const TEXT_SIZE_RE = /^text-(?:xs|sm|base|lg|xl|[2-9]xl)$/;
const PAD_RE = /^p-\d+$/;
const ROUND_RE = /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/;

export const TEXT_SIZES = ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl"];
export const PADDINGS = ["p-0", "p-2", "p-3", "p-4", "p-6", "p-8"];
export const RADII = ["rounded-none", "rounded-md", "rounded-xl", "rounded-full"];

export const bgAction = (cls: string, label: string): ClassAction => ({
  label: `พื้นหลัง ${label}`,
  add: [cls],
  replaces: BG_RE,
});
export const textColorAction = (cls: string, label: string): ClassAction => ({
  label: `สีตัวอักษร ${label}`,
  add: [cls],
  replaces: TEXT_COLOR_RE,
});
export const textSizeAction = (cls: string): ClassAction => ({
  label: `ขนาดตัวอักษร ${cls}`,
  add: [cls],
  replaces: TEXT_SIZE_RE,
});
export const paddingAction = (cls: string): ClassAction => ({
  label: `ระยะห่างใน ${cls}`,
  add: [cls],
  replaces: PAD_RE,
});
export const radiusAction = (cls: string): ClassAction => ({
  label: `ความมน ${cls}`,
  add: [cls],
  replaces: ROUND_RE,
});
