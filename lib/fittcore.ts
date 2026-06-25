"use client";

import type { ProjectRecord } from "./types";

function slug(name: string): string {
  return name.replace(/[^\w฀-๿-]+/g, "-").toLowerCase() || "demo";
}

/** Fence `content` so embedded ``` runs never break out of the code block. */
function fence(content: string, lang: string): string {
  let ticks = "```";
  while (content.includes(ticks)) ticks += "`";
  return `${ticks}${lang}\n${content}\n${ticks}`;
}

/**
 * Build a FITTCORE V2 hand-off spec — a Markdown issue body capturing the brief,
 * the requirements (the user's prompts), and the prototype's full source, so the
 * demo can be rebuilt as a production app. No API yet (interim flow): the spec is
 * generated for the user to file as an issue manually.
 */
export function buildFittcoreSpec(project: ProjectRecord): string {
  const files = project.files ?? {};
  const paths = Object.keys(files).sort();

  const requirements =
    project.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.trim())
      .filter(Boolean)
      .map((p, i) => `${i + 1}. ${p}`)
      .join("\n") || "_(ไม่มี prompt บันทึกไว้)_";

  const tree = paths.map((p) => `- \`${p}\``).join("\n") || "_(ยังไม่มีไฟล์)_";

  const sources = paths
    .map((p) => `### \`${p}\`\n\n${fence(files[p], p.split(".").pop() ?? "")}`)
    .join("\n\n");

  return `# ${project.name}

> FITTCORE V2 hand-off — ต้นแบบจาก FITT Builder เพื่อนำไปสร้างเป็นของจริง

## Overview

ต้นแบบนี้สร้างด้วย FITT Builder เป็น Vite SPA ที่รันได้จริงใน browser
ใช้เป็น reference สำหรับสร้าง production app บน FITTCORE V2

## Requirements (จาก prompt ของผู้ใช้)

${requirements}

## Prototype file manifest

${tree}

## Metadata

| field | value |
| --- | --- |
| Project ID | \`${project.id}\` |
| Phase | \`${project.phase}\` |
${project.skillId ? `| Skill template | \`${project.skillId}\` |\n` : ""}| Created | ${project.createdAt} |
| Updated | ${project.updatedAt} |

## Prototype source

${sources}
`;
}

/** Download the spec as a `.fittcore.md` file (interim hand-off mechanism). */
export function downloadFittcoreSpec(project: ProjectRecord): void {
  const blob = new Blob([buildFittcoreSpec(project)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug(project.name)}.fittcore.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
