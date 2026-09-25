import { MODULE_SOURCES } from "./generated/sources";

/**
 * A module's own files, addressed the way the WebContainer project lays them out.
 *
 * The content comes from `demo/modules/<id>/`, the same files the product renders
 * as pages. Two copies of a screen is the failure this exists to prevent: the one
 * a customer clicks through and the one shipped into their project would drift,
 * and nobody would notice until a buyer asked why the demo and the build differ.
 */
export function filesFor(id: string, names: string[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of names) {
    const source = MODULE_SOURCES[`${id}/${name}`];
    if (source === undefined) {
      throw new Error(`โมดูล ${id} อ้างไฟล์ ${name} ที่ไม่มีใน demo/modules — รัน npm run modules:sync`);
    }
    files[`src/modules/${id}/${name}`] = source;
  }
  return files;
}

/** The shared screen pieces. Composer-owned, like the app shell. */
export const SHARED_SOURCES: Record<string, string> = {
  "src/modules/ui.tsx": MODULE_SOURCES["ui.tsx"],
  "src/modules/kit.tsx": MODULE_SOURCES["kit.tsx"],
  "src/modules/company.ts": MODULE_SOURCES["company.ts"],
};

/**
 * The same pieces, shipped into a build the model writes itself — plus the frame.
 *
 * They land where that project's structure contract keeps its primitives, so an
 * edit turn that asks for "the project's existing components/ui primitive" finds
 * these rather than writing a second Card. The shell comes too: a module project
 * has its App.tsx written by the composer, a generated one has the model write
 * it, and this is what it writes it around.
 */
export const KIT_SOURCES: Record<string, string> = {
  "src/components/ui/ui.tsx": MODULE_SOURCES["ui.tsx"],
  "src/components/ui/kit.tsx": MODULE_SOURCES["kit.tsx"],
  "src/components/ui/shell.tsx": MODULE_SOURCES["shell.tsx"],
};
