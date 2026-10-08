import { resolveImport } from "./import-check";

/**
 * Give a module the default export its importers expect.
 *
 * App.tsx writes `import ApprovalsPage from "./pages/ApprovalsPage"` for every
 * page, and now and then the page itself is written `export function
 * ApprovalsPage()` with no default — the browser then stops on "does not
 * provide an export named 'default'" and the whole app is a white screen
 * (case #1, 8 Oct 2026). Which name the importer wants and that the module
 * already has it are both facts in the files, so the fix is ours to make:
 * `export default ApprovalsPage;` at the end of the module.
 *
 * Only when the module exports that exact name. A default import of a name the
 * module does not have is a real mistake, and is left to fail loudly.
 */

const SOURCE_FILE = /\.[jt]sx?$/;
// import Name from "./x"  ·  import Name, { other } from "./x"   (not `import type`)
const DEFAULT_IMPORT_RE = /^import\s+(?!type\s)([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*["'](\.{1,2}\/[^"']+)["']/gm;
const HAS_DEFAULT_RE = /^export\s+default\s|^export\s*\{[^}]*\bas\s+default\b/m;

function exportsName(source: string, name: string): boolean {
  const declared = new RegExp(`^export\\s+(?:async\\s+)?(?:function\\*?|const|let|var|class)\\s+${name}\\b`, "m");
  const listed = new RegExp(`^export\\s*\\{[^}]*\\b${name}\\b(?!\\s+as)[^}]*\\}`, "m");
  return declared.test(source) || listed.test(source);
}

/** The modules that need a default export added, as path → fixed content. */
export function missingDefaultExports(files: Record<string, string>): Record<string, string> {
  const paths = new Set(Object.keys(files));
  const wanted = new Map<string, string>();
  for (const [from, content] of Object.entries(files)) {
    if (!SOURCE_FILE.test(from) || typeof content !== "string") continue;
    for (const [, name, spec] of content.matchAll(DEFAULT_IMPORT_RE)) {
      const target = resolveImport(from, spec, paths);
      if (!target || !SOURCE_FILE.test(target) || wanted.has(target)) continue;
      const source = files[target];
      if (HAS_DEFAULT_RE.test(source) || !exportsName(source, name)) continue;
      wanted.set(target, name);
    }
  }
  return Object.fromEntries(
    [...wanted].map(([path, name]) => [path, `${files[path].replace(/\s*$/, "")}\n\nexport default ${name};\n`])
  );
}
