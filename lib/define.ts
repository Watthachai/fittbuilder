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
