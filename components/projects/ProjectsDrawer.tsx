"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, FileCode, FolderGit2, Search, Trash2, Users, X } from "lucide-react";
import { deleteProject, duplicateProject, listProjects } from "@/lib/storage";
import type { ProjectSummary } from "@/lib/types";

type Tab = "mine" | "shared";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function groupByTime(items: ProjectSummary[]): { label: string; items: ProjectSummary[] }[] {
  const now = Date.now();
  const b: Record<string, ProjectSummary[]> = { recent: [], month: [], older: [] };
  for (const p of items) {
    const age = now - new Date(p.updatedAt).getTime();
    if (age <= 7 * 864e5) b.recent.push(p);
    else if (age <= 30 * 864e5) b.month.push(p);
    else b.older.push(p);
  }
  return [
    { label: "7 วันล่าสุด", items: b.recent },
    { label: "30 วันล่าสุด", items: b.month },
    { label: "ก่อนหน้านี้", items: b.older },
  ].filter((g) => g.items.length > 0);
}

/** Floating, collapsible projects sidebar (Stitch-style) — slides in from the
 *  left with margins. Controlled by the host (`open` / `onClose`). */
export default function ProjectsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setError(null);
    } catch {
      setError("เข้าสู่ระบบเพื่อดูผลงานของคุณ");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch each time the drawer opens so the list is fresh.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listProjects();
        if (!cancelled) {
          setProjects(list);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("เข้าสู่ระบบเพื่อดูผลงานของคุณ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { mine, shared } = useMemo(
    () => ({
      mine: projects.filter((p) => p.access === "owner"),
      shared: projects.filter((p) => p.access === "member"),
    }),
    [projects]
  );
  const visible = useMemo(() => {
    const base = tab === "mine" ? mine : shared;
    const q = query.trim().toLowerCase();
    return q ? base.filter((p) => p.name.toLowerCase().includes(q)) : base;
  }, [tab, mine, shared, query]);
  const groups = useMemo(() => groupByTime(visible), [visible]);

  const openProject = (id: string) => {
    onClose();
    router.push(`/project/${id}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.aside
            initial={{ x: "-110%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-110%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass fixed bottom-3 left-3 top-3 z-50 flex w-80 flex-col overflow-hidden rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="font-display text-sm font-semibold text-chalk">ผลงาน</span>
              <button onClick={onClose} aria-label="หุบ" className="text-chalk-dim transition hover:text-chalk">
                <X size={18} />
              </button>
            </div>

            <div className="mx-3 grid grid-cols-2 gap-1 rounded-xl border border-night-edge bg-night/40 p-1">
              <button
                onClick={() => setTab("mine")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                  tab === "mine" ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
                }`}
              >
                <FolderGit2 size={13} /> ของฉัน
              </button>
              <button
                onClick={() => setTab("shared")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
                  tab === "shared" ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
                }`}
              >
                <Users size={13} /> แชร์กับฉัน
              </button>
            </div>

            <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-night-edge bg-night/40 px-3">
              <Search size={14} className="shrink-0 text-chalk-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาโปรเจกต์"
                className="w-full bg-transparent py-2 text-sm text-chalk outline-none placeholder:text-chalk-dim/50"
              />
            </div>

            <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {loading ? (
                <p className="px-2 py-4 text-sm text-chalk-dim">กำลังโหลด…</p>
              ) : error ? (
                <p className="px-2 py-4 text-sm text-chalk-dim">{error}</p>
              ) : visible.length === 0 ? (
                <p className="px-2 py-6 text-sm text-chalk-dim">
                  {query
                    ? "ไม่พบโปรเจกต์ที่ค้นหา"
                    : tab === "mine"
                      ? "ยังไม่มีโปรเจกต์ — เริ่มสร้างได้เลย"
                      : "ยังไม่มีใครแชร์โปรเจกต์ให้คุณ"}
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="mb-3">
                    <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                      {g.label}
                    </p>
                    {g.items.map((p) => (
                      <div
                        key={p.id}
                        className="group relative flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-chalk/5"
                      >
                        <button
                          onClick={() => openProject(p.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-night-edge bg-night/40">
                            <FileCode size={15} className="text-shine/70" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-chalk">{p.name}</span>
                            <span className="block truncate font-mono text-[10px] text-chalk-dim">
                              {formatDate(p.updatedAt)}
                              {p.access === "member" && p.role ? ` · ${p.role}` : ""}
                            </span>
                          </span>
                        </button>
                        {p.access === "owner" && (
                          <div className="absolute right-1 hidden items-center gap-0.5 rounded-lg bg-night-panel/90 px-1 group-hover:flex">
                            <button
                              onClick={async () => {
                                await duplicateProject(p.id);
                                await refresh();
                              }}
                              title="Duplicate"
                              className="grid h-7 w-7 place-items-center rounded-md text-chalk-dim transition hover:text-shine"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`ลบ "${p.name}" ถาวร?`)) return;
                                await deleteProject(p.id);
                                await refresh();
                              }}
                              title="ลบ"
                              className="grid h-7 w-7 place-items-center rounded-md text-chalk-dim transition hover:text-halt"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
