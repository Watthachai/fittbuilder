import { docsFromFiles } from "./define";
import { screenIndexEntries } from "./screen-index";
import type { ProjectFiles } from "./types";

/**
 * Screens the demo has that its brief has never heard of.
 *
 * The BRD and PRD are written at Define/Plan time and then the build moves on.
 * Nothing marks them stale, so they keep being read — by the Code Runner
 * hand-off, by the quotation's scope, by the premium advice — long after they
 * stopped describing the thing that exists. The person who could fix that in one
 * click is the last to find out.
 *
 * Deliberately NOT an AI call: it runs on every render of the phase bar, it has
 * to be instant and free, and "this screen's name appears nowhere in the brief"
 * is a fact, not a judgement. The button it feeds is what asks a model anything.
 *
 * ONE-DIRECTIONAL on purpose. The reverse — the brief promising screens that
 * were never built — cannot be detected this way without reading the prose the
 * way a person does, and a wrong warning about a missing feature is worse than
 * no warning at all. The update itself still handles both directions; only the
 * detection is narrow.
 */
export function undocumentedScreens(files: ProjectFiles | null): string[] {
  const docs = docsFromFiles(files);
  const brief = `${docs.brd ?? ""}\n${docs.prd ?? ""}`.toLowerCase();
  // No brief yet means nothing has drifted — the docs simply have not been
  // written, which the phase flow already asks for.
  if (!brief.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of screenIndexEntries(files)) {
    const name = entry.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (!brief.includes(name.toLowerCase())) out.push(name);
  }
  return out;
}
