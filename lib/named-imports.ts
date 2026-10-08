import { resolveImport } from "./import-check";

/**
 * Named imports that point at a module which no longer exports the name.
 *
 * An edit turn that rewrites a shared file — "ขอสีฟ้าขาวและรองรับ responsive"
 * rewrote the kit's ui.tsx — can drop an export another file still uses, and
 * the browser stops on "does not provide an export named 'Skeleton'" (case #2,
 * 8 Oct 2026). Which names are imported and which are exported are both in the
 * files, so a broken pair is found exactly and handed back to the model by
 * name, instead of waiting for a white screen and a report.
 */

const SOURCE_FILE = /\.[jt]sx?$/;
// import { A, B as C, type D } from "./x"  ·  import Def, { A } from "./x"  (not `import type { … }`)
const NAMED_IMPORT_RE = /^import\s+(?!type\s)(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*["'](\.{1,2}\/[^"']+)["']/gm;
const DECLARED_RE = /^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
const LISTED_RE = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;
const STAR_RE = /^export\s+\*/m;

export interface BrokenImport {
  /** The file that imports the name. */
  from: string;
  /** The module it imports from, which does not export the name. */
  target: string;
  name: string;
}

/** Every name a module exports, or null when `export *` makes that unknowable. */
function exportsOf(source: string): Set<string> | null {
  if (STAR_RE.test(source)) return null;
  const names = new Set([...source.matchAll(DECLARED_RE)].map((m) => m[1]));
  for (const [, list] of source.matchAll(LISTED_RE)) {
    for (const item of list.split(",")) {
      const parts = item.replace(/^\s*type\s+/, "").trim().split(/\s+as\s+/);
      const exported = (parts[1] ?? parts[0]).trim();
      if (exported) names.add(exported);
    }
  }
  return names;
}

export function brokenNamedImports(files: Record<string, string> | null | undefined): BrokenImport[] {
  if (!files) return [];
  const paths = new Set(Object.keys(files));
  const out: BrokenImport[] = [];
  const cache = new Map<string, Set<string> | null>();
  for (const [from, content] of Object.entries(files)) {
    if (!SOURCE_FILE.test(from) || typeof content !== "string") continue;
    for (const [, list, spec] of content.matchAll(NAMED_IMPORT_RE)) {
      const target = resolveImport(from, spec, paths);
      if (!target || !SOURCE_FILE.test(target)) continue;
      if (!cache.has(target)) cache.set(target, exportsOf(files[target]));
      const exported = cache.get(target);
      if (!exported) continue;
      for (const item of list.split(",")) {
        const trimmed = item.trim();
        // `type X` inside the braces is erased before it runs — not a white screen.
        if (!trimmed || trimmed.startsWith("type ")) continue;
        const name = trimmed.split(/\s+as\s+/)[0].trim();
        if (!exported.has(name)) out.push({ from, target, name });
      }
    }
  }
  return out;
}

/** One turn's worth of instruction to put the missing names back. */
export function restoreExportsPrompt(broken: BrokenImport[]): string {
  const byTarget = new Map<string, BrokenImport[]>();
  for (const b of broken) byTarget.set(b.target, [...(byTarget.get(b.target) ?? []), b]);
  const lines = [...byTarget].map(
    ([target, items]) =>
      `- ${target} ไม่มี export ${[...new Set(items.map((b) => b.name))].join(", ")} แล้ว แต่ ${[
        ...new Set(items.map((b) => b.from)),
      ].join(", ")} ยังใช้อยู่`
  );
  return `รอบที่แล้วแก้ไฟล์จนบาง export หายไป แต่ไฟล์อื่นยัง import อยู่ แอปจึงขึ้น error "does not provide an export named …"

${lines.join("\n")}

เพิ่ม export ที่หายไปกลับเข้าไฟล์ต้นทางให้ครบ ให้หน้าตาเข้ากับดีไซน์ปัจจุบันของไฟล์นั้น ห้ามลบหรือเปลี่ยนชื่อ export อื่น และไม่ต้องแก้ไฟล์ที่ import`;
}
