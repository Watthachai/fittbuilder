"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  FileCode,
  FolderGit2,
  Menu,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { deleteProject, duplicateProject, listProjects } from "@/lib/storage";
import type { ProjectSummary } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { isChangelogUnseen } from "@/lib/changelog";
import AccountMenu from "@/components/AccountMenu";
import LaunchPad from "@/components/landing/LaunchPad";

type Tab = "mine" | "shared";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** Group projects into time buckets (newest first within each). */
function groupByTime(items: ProjectSummary[]): { label: string; items: ProjectSummary[] }[] {
  const now = Date.now();
  const buckets: Record<string, ProjectSummary[]> = { recent: [], month: [], older: [] };
  for (const p of items) {
    const age = now - new Date(p.updatedAt).getTime();
    if (age <= 7 * 864e5) buckets.recent.push(p);
    else if (age <= 30 * 864e5) buckets.month.push(p);
    else buckets.older.push(p);
  }
  return [
    { label: "7 วันล่าสุด", items: buckets.recent },
    { label: "30 วันล่าสุด", items: buckets.month },
    { label: "ก่อนหน้านี้", items: buckets.older },
  ].filter((g) => g.items.length > 0);
}

export default function ProjectGrid() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changelogUnseen, setChangelogUnseen] = useState(false);
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (e) {
      console.error("[ProjectGrid] listProjects failed:", e);
      setLoadError("โหลดโปรเจกต์ไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listProjects();
        if (!cancelled) setProjects(list);
      } catch (e) {
        if (!cancelled) {
          console.error("[ProjectGrid] listProjects failed:", e);
          setLoadError("โหลดโปรเจกต์ไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const { data } = await supabase
        .from("fittbuilder_profiles")
        .select("last_seen_changelog")
        .eq("id", user.id)
        .single();
      if (!cancelled) setChangelogUnseen(isChangelogUnseen(data?.last_seen_changelog ?? null));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function remove(p: ProjectSummary) {
    if (!confirm(`ลบ "${p.name}" ถาวร?`)) return;
    await deleteProject(p.id);
    await refresh();
  }
  async function duplicate(p: ProjectSummary) {
    await duplicateProject(p.id);
    await refresh();
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-night text-chalk">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-night/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-night-edge bg-night-panel transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-chalk">
              <span className="h-2 w-2 rounded-full bg-chalk" />
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">FITT Builder</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-chalk-dim md:hidden"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-3 grid grid-cols-2 gap-1 rounded-xl border border-night-edge bg-night p-1">
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

        {/* Search */}
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-night-edge bg-night px-3">
          <Search size={14} className="shrink-0 text-chalk-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาโปรเจกต์"
            className="w-full bg-transparent py-2 text-sm text-chalk outline-none placeholder:text-chalk-dim/50"
          />
        </div>

        {/* List */}
        <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <p className="px-2 py-4 text-sm text-chalk-dim">กำลังโหลด…</p>
          ) : loadError ? (
            <p className="px-2 py-4 text-sm text-halt">{loadError}</p>
          ) : visible.length === 0 ? (
            <p className="px-2 py-6 text-sm text-chalk-dim">
              {query
                ? "ไม่พบโปรเจกต์ที่ค้นหา"
                : tab === "mine"
                  ? "ยังไม่มีโปรเจกต์ — เริ่มสร้างทางขวา"
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
                      onClick={() => router.push(`/project/${p.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-night-edge bg-night">
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
                          onClick={() => void duplicate(p)}
                          title="Duplicate"
                          className="grid h-7 w-7 place-items-center rounded-md text-chalk-dim transition hover:text-shine"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => void remove(p)}
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
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-night-edge px-4 py-3 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-chalk-dim md:hidden"
            aria-label="เมนูโปรเจกต์"
          >
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/changelog"
              className="relative inline-flex items-center gap-1.5 rounded-full border border-chalk/20 px-3.5 py-1.5 font-display text-sm text-chalk/70 transition hover:border-chalk/40 hover:text-chalk"
            >
              <Sparkles size={14} /> มีอะไรใหม่
              {changelogUnseen && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-shine" />
              )}
            </Link>
            <AccountMenu />
          </div>
        </header>

        <main className="scroll-thin flex-1 overflow-y-auto">
          <div className="stitch mx-auto flex max-w-3xl flex-col px-6 py-14 sm:py-20">
            <h1 className="text-center font-display text-3xl font-medium tracking-tight sm:text-4xl">
              วันนี้อยากสร้างอะไร?
            </h1>
            <p className="mt-2 text-center text-chalk/60">
              พิมพ์ไอเดียเป็นภาษาไทยหรืออังกฤษ แล้วได้เว็บ demo ที่รันจริงในเบราว์เซอร์
            </p>
            <div className="mt-8 flex justify-center">
              <LaunchPad />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
