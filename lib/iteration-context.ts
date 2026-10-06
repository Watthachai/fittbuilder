import { relativeImports, resolveImport } from "./import-check";

/**
 * Which files an edit turn shows the model.
 *
 * An edit used to send every file in the project. That stops working at a size
 * real projects reach: one grew to 508 files and 3.8 million characters, its
 * edits climbed to 937k input tokens against a model limit of about 1M, and from
 * then on every edit failed — even "hi". Past CONTEXT_BUDGET_CHARS an edit sends
 * the files this request needs in full and names the rest, so the project keeps
 * being editable however large it grows. Below the budget nothing changes.
 */

/** About 400k tokens of code: well under the model's limit, and far above a typical project (p95 ≈ 1 MB). */
export const CONTEXT_BUDGET_CHARS = 1_600_000;

/** Always worth seeing: how the app starts, what it depends on, and its shared types. */
const CORE = ["package.json", "index.html", "src/main.tsx", "src/App.tsx", "src/types.ts", "src/index.css"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Files the request names. The Wand writes the path ("ไฟล์: src/…/Sidebar.tsx"),
 * an error carries it ("/src/pages/X.tsx"), and a person types a file name.
 */
export function namedIn(prompt: string, paths: string[]): string[] {
  return paths.filter((path) => {
    if (prompt.includes(path)) return true;
    const name = path.slice(path.lastIndexOf("/") + 1);
    return /\.[a-z]+$/i.test(name) && new RegExp(`(^|[^\\w.-])${escape(name)}(?![\\w-])`).test(prompt);
  });
}

/** What these files import, and what imports them — one step out. */
export function neighboursOf(files: Record<string, string>, seeds: string[]): string[] {
  const paths = new Set(Object.keys(files));
  const seedSet = new Set(seeds);
  const found = new Set<string>();
  for (const [from, content] of Object.entries(files)) {
    for (const spec of relativeImports(content)) {
      const target = resolveImport(from, spec, paths);
      if (!target) continue;
      if (seedSet.has(from) && !seedSet.has(target)) found.add(target);
      if (seedSet.has(target) && !seedSet.has(from)) found.add(from);
    }
  }
  return [...found];
}

const sizeOf = (files: Record<string, string>) => Object.values(files).reduce((n, c) => n + c.length, 0);

export const overBudget = (files: Record<string, string>, budget = CONTEXT_BUDGET_CHARS) => sizeOf(files) > budget;

/**
 * The files to show, in order of need — what the request wants, the core, then
 * their neighbours — until the budget is spent. Everything else is `omitted`, to
 * be listed by path so the model knows it exists.
 */
export function contextFor(
  files: Record<string, string>,
  wanted: string[],
  budget = CONTEXT_BUDGET_CHARS
): { shown: Record<string, string>; omitted: string[] } {
  if (!overBudget(files, budget)) return { shown: files, omitted: [] };
  const order = [...new Set([...wanted, ...CORE, ...neighboursOf(files, wanted)])].filter((p) => p in files);
  const shown: Record<string, string> = {};
  let used = 0;
  for (const path of order) {
    if (used + files[path].length > budget) continue;
    shown[path] = files[path];
    used += files[path].length;
  }
  return { shown, omitted: Object.keys(files).filter((p) => !(p in shown)) };
}
