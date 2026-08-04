import type { ProjectFiles } from "./types";

/**
 * Find relative imports that point at a file the project does not contain.
 *
 * This is the failure that reaches the user as a white screen: Vite answers 500
 * for the entry module, the page reports "โหลดสคริปต์ไม่สำเร็จ", and the actual
 * cause — `Failed to resolve import "./components/Sidebar" from "src/App.tsx"` —
 * is buried in an overlay. Since v0.44.0 the generator emits a dozen-plus files
 * per build, so a truncated stream or a forgotten file is a live risk; checking
 * it costs nothing and turns a mystery into a one-click fix.
 */

const SOURCE_FILE = /\.(tsx?|jsx?)$/;
// import x from "./y" · import "./y" · export … from "./y" · import("./y")
const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*["'](\.[^"']+)["']|(?:^|[\s;])import\s*["'](\.[^"']+)["']|\bimport\(\s*["'](\.[^"']+)["']\s*\)/g;

/** Resolve "src/a/b.tsx" + "../c/d" → "src/c/d" (no leading ./ or ../ left). */
function resolveFrom(fromPath: string, spec: string): string {
  const base = fromPath.split("/").slice(0, -1);
  const parts = spec.split("/");
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

/** The paths Vite would try for a bare specifier. */
function candidates(path: string): string[] {
  return [
    path,
    `${path}.tsx`,
    `${path}.ts`,
    `${path}.jsx`,
    `${path}.js`,
    `${path}.css`,
    `${path}.json`,
    `${path}/index.tsx`,
    `${path}/index.ts`,
    `${path}/index.jsx`,
    `${path}/index.js`,
  ];
}

export interface MissingImport {
  /** File that contains the import. */
  from: string;
  /** The specifier as written, e.g. "./components/Sidebar". */
  spec: string;
  /** Where it would have to live, e.g. "src/components/Sidebar". */
  expected: string;
}

/** Every relative import in the project that resolves to nothing, deduped. */
export function missingImports(files: ProjectFiles | null | undefined): MissingImport[] {
  if (!files) return [];
  const paths = new Set(Object.keys(files));
  const out: MissingImport[] = [];
  const seen = new Set<string>();

  for (const [from, content] of Object.entries(files)) {
    if (!SOURCE_FILE.test(from) || typeof content !== "string") continue;
    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(content)) !== null) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec) continue;
      const expected = resolveFrom(from, spec);
      if (candidates(expected).some((c) => paths.has(c))) continue;
      const key = `${from}→${spec}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from, spec, expected });
    }
  }
  return out;
}

/** The fix-it turn: name every missing file so the model creates exactly those. */
export function buildMissingFilesPrompt(missing: MissingImport[]): string {
  const lines = missing.map((m) => `- ${m.expected} (import "${m.spec}" จาก ${m.from})`);
  return `แอปรันไม่ได้เพราะมีไฟล์ที่ถูก import แต่ไม่มีอยู่จริงในโปรเจกต์:
${lines.join("\n")}

สร้างไฟล์ที่ขาดเหล่านี้ให้ครบ โดยให้เนื้อหาตรงกับวิธีที่ไฟล์ต้นทางเรียกใช้ (ชื่อ export, props ที่ส่งเข้ามา, ชนิดข้อมูล) และเข้ากับดีไซน์เดิมของแอป
ห้ามแก้ไฟล์อื่นที่ไม่เกี่ยวข้อง และห้ามลบ import เหล่านี้ทิ้งเพื่อเลี่ยงปัญหา`;
}
