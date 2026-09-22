"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules/registry";
import { projectFilesFor } from "@/lib/modules/project";
import { createProject, saveProject } from "@/lib/storage";
import { mayOpen } from "./session";
import type { Role } from "./session";
import type { ModuleFamily } from "@/lib/modules/types";
import { FAMILIES } from "@/lib/modules/registry";

/**
 * Take what you just used and keep it.
 *
 * The scope is the modules this account can open — chosen by using the system
 * rather than ticked off a list beforehand — so the two phases that exist to
 * establish scope are already answered by the time the project is created.
 */
export default function TakeProject({ role, only }: { role: Role; only?: ModuleFamily }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();

  // In a trial, the parts of that system this seat may open; otherwise everything it may.
  const selected = MODULES.filter((m) => mayOpen(role, m.id) && (!only || m.family === only));

  const take = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const project = await createProject({
        name: selected.map((m) => m.name).join(" · "),
        phase: "build",
      });
      await saveProject({
        ...project,
        files: projectFilesFor(selected),
        phase: "build",
        approvedPhases: ["define", "plan"],
      });
      router.push(`/project/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="max-w-[18rem] truncate text-[11.5px] text-rose-600">{error}</span>}
      <button
        onClick={() => void take()}
        disabled={busy}
        className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
      >
        {busy ? "กำลังสร้าง…" : only ? `สร้างโปรเจกต์จากระบบ${FAMILIES.find((f) => f.id === only)?.name}` : `สร้างโปรเจกต์จาก ${selected.length} ส่วนนี้`}
      </button>
    </div>
  );
}
