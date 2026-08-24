"use client";

import type { ProjectFiles } from "./types";
import { versionTag, type VersionKey } from "./versions";
import { retargetAssetProxy } from "./asset-retarget";
import { exportSiteUrl } from "./export-origin";

/**
 * Export the generated project as a downloadable .zip (US-012).
 *
 * `version` marks the tier in the filename. Without it both tiers download as
 * the same name and the browser silently appends "(1)" — leaving two files that
 * differ by a paid feature and nothing else to tell them apart.
 */
export async function downloadZip(
  files: ProjectFiles,
  projectName: string,
  version: VersionKey = "standard"
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  // The zip runs far from this machine — its relay URLs must point at the
  // public site, not at whatever origin happened to generate the files.
  const shipped = retargetAssetProxy(files, await exportSiteUrl());
  for (const [path, contents] of Object.entries(shipped)) {
    zip.file(path, contents);
  }
  zip.file(
    "README.md",
    `# ${projectName}\n\nสร้างด้วย FITT Builder\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`
  );
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const base = projectName.replace(/[^\w฀-๿-]+/g, "-").toLowerCase() || "demo";
  anchor.download = `${base}${versionTag(version)}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}
