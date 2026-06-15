"use client";

import type { ProjectFiles } from "./types";

/** Export the generated project as a downloadable .zip (US-012). */
export async function downloadZip(files: ProjectFiles, projectName: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [path, contents] of Object.entries(files)) {
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
  anchor.download = `${projectName.replace(/[^\w฀-๿-]+/g, "-").toLowerCase() || "demo"}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}
