"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, FileCode, Plus, Trash2 } from "lucide-react";
import { deleteProject, duplicateProject, listProjects } from "@/lib/storage";
import type { ProjectSummary } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProjectGrid() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);

  const refresh = () => setProjects(listProjects());
  useEffect(() => {
    // localStorage is browser-only; defer past the first paint.
    queueMicrotask(refresh);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            FITT Builder
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 font-display text-sm font-semibold text-black transition hover:bg-gray-200"
        >
          <Plus size={15} /> สร้างใหม่
        </Link>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24 pt-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">ผลงานของฉัน</h1>
        <p className="mt-1 text-white/70">
          เก็บไว้ในเครื่องของคุณ — เปิด แก้ต่อ duplicate หรือลบได้
        </p>

        {projects === null ? null : projects.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] p-14 text-center">
            <p className="font-display text-lg text-white/70">ยังไม่มีโปรเจกต์</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 font-display text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              <Plus size={15} /> สร้าง demo แรกของคุณ
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-shine/50"
              >
                <button
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="block w-full p-5 text-left"
                >
                  <div className="bg-grid flex h-24 items-center justify-center rounded-xl border border-white/10">
                    <FileCode size={22} className="text-shine/60" />
                  </div>
                  <h2 className="mt-4 truncate font-display text-base font-semibold">
                    {project.name}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] text-white/50">
                    {project.fileCount > 0 ? `${project.fileCount} ไฟล์ · ` : ""}แก้ล่าสุด{" "}
                    {formatDate(project.updatedAt)}
                  </p>
                </button>
                <div className="flex border-t border-white/10">
                  <button
                    onClick={() => {
                      duplicateProject(project.id);
                      refresh();
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 py-2.5 font-display text-xs text-white/60 transition hover:bg-shine/5 hover:text-shine"
                  >
                    <Copy size={12} /> Duplicate
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`ลบ "${project.name}" ถาวร?`)) {
                        deleteProject(project.id);
                        refresh();
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 border-l border-white/10 py-2.5 font-display text-xs text-white/60 transition hover:bg-halt/5 hover:text-halt"
                  >
                    <Trash2 size={12} /> ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
