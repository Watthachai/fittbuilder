import { resolveFrom } from "./import-check";
import { KIT_SOURCES } from "./modules/sources";

/**
 * Point every kit import at the kit file that actually exports the name.
 *
 * The kit a build starts with is three sibling files, and the split between them
 * means nothing to the model: it is told DetailModal lives in kit.tsx and Modal
 * in ui.tsx, and it still writes `import { DetailModal } from
 * "../components/ui/ui"` often enough that a fresh build regularly opens on
 * "does not provide an export named 'DetailModal'". The kit's exports are known
 * exactly, and no name is exported by two of its files, so where the model put a
 * name is a fact we can correct rather than a request we can only repeat.
 *
 * Only a name the kit really exports somewhere else is moved. A name no kit file
 * has is left alone, so a genuine mistake still fails loudly.
 */

const SOURCE_FILE = /\.[jt]sx?$/;
const EXPORT_RE = /^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/gm;
// import { A, B as C, type D } from "./x"  ·  import type { A } from "./x"
const IMPORT_RE = /^import\s+(type\s+)?\{([^}]*)\}\s*from\s*(["'])(\.{1,2}\/[^"']+)\3;?[ \t]*$/gm;

/** The kit files a project carries, by path — empty for a project built without the kit. */
export function kitOf(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.keys(KIT_SOURCES)
      .filter((path) => typeof files[path] === "string")
      .map((path) => [path, files[path]])
  );
}

/** The kit declares every export in place (`export function …`, `export const …`). */
const exportsOf = (source: string) => new Set([...source.matchAll(EXPORT_RE)].map((m) => m[1]));

const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/"));

interface Binding {
  /** As written, e.g. "ConfirmDialog as Confirm" or "type Step". */
  text: string;
  name: string;
  local: string;
}

function bindingsOf(body: string): Binding[] {
  return body
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const [name, local] = text.replace(/^type\s+/, "").split(/\s+as\s+/);
      return { text, name, local: local ?? name };
    });
}

export function fixKitImports(path: string, content: string, kit: Record<string, string>): string {
  if (!SOURCE_FILE.test(path)) return content;
  const exported = new Map(Object.entries(kit).map(([key, source]) => [key, exportsOf(source)]));
  if (exported.size === 0) return content;

  const keyOf = (spec: string) => {
    const resolved = resolveFrom(path, spec);
    return [...exported.keys()].find((key) => key === resolved || key.replace(SOURCE_FILE, "") === resolved);
  };
  /** The specifier for a sibling kit file, written the way the original was. */
  const specFor = (spec: string, key: string) => {
    const file = key.slice(key.lastIndexOf("/") + 1);
    return spec.replace(/[^/]+$/, SOURCE_FILE.test(spec) ? file : file.replace(SOURCE_FILE, ""));
  };

  // What each kit file already provides this file, so a moved name never
  // declares the same binding twice.
  const bound = new Map([...exported.keys()].map((key) => [key, new Set<string>()]));
  for (const [, , body, , spec] of content.matchAll(IMPORT_RE)) {
    const key = keyOf(spec);
    if (!key) continue;
    for (const b of bindingsOf(body)) if (exported.get(key)!.has(b.name)) bound.get(key)!.add(b.local);
  }

  return content.replace(IMPORT_RE, (whole, typeKw: string | undefined, body: string, quote: string, spec: string) => {
    const key = keyOf(spec);
    if (!key) return whole;
    const groups = new Map<string, Binding[]>([[key, []]]);
    let moved = false;
    for (const b of bindingsOf(body)) {
      const home: string | undefined = exported.get(key)!.has(b.name)
        ? key
        : [...exported.keys()].find((k) => dirOf(k) === dirOf(key) && exported.get(k)!.has(b.name));
      if (!home || home === key) {
        groups.get(key)!.push(b);
        continue;
      }
      moved = true;
      if (bound.get(home)!.has(b.local)) continue;
      bound.get(home)!.add(b.local);
      groups.set(home, [...(groups.get(home) ?? []), b]);
    }
    if (!moved) return whole;
    return [...groups]
      .filter(([, bs]) => bs.length > 0)
      .map(([k, bs]) => `import ${typeKw ?? ""}{ ${bs.map((b) => b.text).join(", ")} } from ${quote}${k === key ? spec : specFor(spec, k)}${quote};`)
      .join("\n");
  });
}
