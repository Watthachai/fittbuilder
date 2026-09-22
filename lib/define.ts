import type { PhaseId } from "./phases";
import type { DocKind, ProjectFiles } from "./types";

/**
 * Phase documents live as plain files inside the project — reviewable/editable
 * in Monaco, mounted into the WebContainer, and included in zip/share like any
 * other file. One markdown file per doc kind.
 */
export const DOC_PATHS: Record<DocKind, string> = {
  idea: "docs/IDEA.md",
  brd: "docs/BRD.md",
  prd: "docs/PRD.md",
  verify: "docs/VERIFY.md",
  review: "docs/REVIEW.md",
  ship: "docs/SHIP.md",
};

/** Read the phase documents out of a project's file map. */
export function docsFromFiles(
  files: ProjectFiles | null
): Partial<Record<DocKind, string>> {
  if (!files) return {};
  const docs: Partial<Record<DocKind, string>> = {};
  for (const kind of Object.keys(DOC_PATHS) as DocKind[]) {
    const contents = files[DOC_PATHS[kind]];
    if (contents) docs[kind] = contents;
  }
  return docs;
}

/** Subset of `files` under docs/ — preserved across full regenerations. */
export function docOnlyFiles(files: ProjectFiles | null): ProjectFiles {
  if (!files) return {};
  return Object.fromEntries(
    Object.entries(files).filter(([path]) => path.startsWith("docs/"))
  );
}

/** A project is runnable once the generator has produced an app. */
export function hasRunnableApp(files: ProjectFiles | null): boolean {
  return Boolean(files && files["package.json"]);
}

/**
 * What each workflow phase has to show for itself.
 *
 * The phase rail used to name the six steps and nothing else, which tells you
 * where you are but not what came of being there. A phase that produced a
 * document names the file; the build phase counts what it wrote. A phase with
 * nothing yet returns nothing rather than a placeholder, because "—" in the rail
 * is already the honest answer.
 */
export function phaseArtefacts(files: ProjectFiles | null): Partial<Record<PhaseId, string>> {
  const docs = docsFromFiles(files);
  const source = files ? Object.keys(files).filter((p) => !p.startsWith("docs/")) : [];
  const out: Partial<Record<PhaseId, string>> = {};
  if (docs.brd) out.define = "BRD.md";
  if (docs.prd) out.plan = "PRD.md";
  if (source.length > 0) out.build = `${source.length} ไฟล์`;
  if (docs.verify) out.verify = "VERIFY.md";
  if (docs.review) out.review = "REVIEW.md";
  if (docs.ship) out.ship = "SHIP.md";
  return out;
}
