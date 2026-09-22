import type { Module } from "./types";
import { projectFilesFor } from "./project";
import { createProject, saveProject } from "@/lib/storage";

/**
 * Turn a chosen scope into a project that is already built.
 *
 * There is nothing for the model to do here: the modules carry their own source,
 * so the files are in place before the studio opens and it boots straight into a
 * running preview. Define and Plan exist to establish scope, and scope is exactly
 * what was just chosen, so both are already answered.
 */
export async function startProjectFromModules(selected: Module[], orgId?: string) {
  if (selected.length === 0) throw new Error("ยังไม่ได้เลือกโมดูล");

  const project = await createProject({
    name: selected.map((m) => m.name).join(" · "),
    phase: "build",
    orgId,
  });
  await saveProject({
    ...project,
    files: projectFilesFor(selected),
    phase: "build",
    approvedPhases: ["define", "plan"],
  });
  return project.id;
}
