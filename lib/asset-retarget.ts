import type { ProjectFiles } from "@/lib/types";

/**
 * Point every asset-relay URL at the origin that is actually serving the
 * studio right now.
 *
 * Generation writes ABSOLUTE relay URLs into the demo's code — the preview
 * runs on *.webcontainer-api.io, so a relative /api/asset would hit the
 * container, not us. But absolute means the generating machine's origin is
 * baked into the saved files: a project generated on localhost carries
 * http://localhost:3000/api/asset?… forever, and opening it on production —
 * or a colleague opening it anywhere — renders a page of broken images,
 * because nothing answers on the viewer's localhost.
 *
 * The origin is the environment's property, not the file's — same rule that
 * makes vite.config.js ours on every mount. So the mount path rewrites every
 * relay origin to the current one, whatever was baked in. Files in the DB
 * keep their historical origin; every place that runs them normalizes.
 */

/** An absolute origin immediately followed by our relay path. */
const RELAY = /https?:\/\/[^\s"'`()\\]*?\/api\/asset\?url=/g;

export function retargetAssetProxy(files: ProjectFiles, origin: string): ProjectFiles {
  const target = `${origin}/api/asset?url=`;
  let changed = false;
  const out: ProjectFiles = {};
  for (const [path, contents] of Object.entries(files)) {
    const next = contents.replace(RELAY, target);
    out[path] = next;
    if (next !== contents) changed = true;
  }
  // Identity when nothing moved, so callers can cheaply skip re-writes.
  return changed ? out : files;
}

/** Single-file form for the incremental write paths. */
export function retargetAssetProxyText(contents: string, origin: string): string {
  return contents.replace(RELAY, `${origin}/api/asset?url=`);
}
