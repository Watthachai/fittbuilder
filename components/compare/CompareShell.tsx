"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { listProjects } from "@/lib/storage";
import { getProject } from "@/lib/storage";
import { isPreviewSupported, prepareWorkdir, runProject } from "@/lib/webcontainer";
import { sanitizeFiles } from "@/lib/files";
import { VITE_CONFIG, withRequiredScaffold } from "@/lib/scaffold";
import type { ProjectSummary } from "@/lib/types";

/**
 * Show a customer two demos side by side — "this is the standard build, this is
 * what Premium adds" — by swapping which one the preview is running.
 *
 * WebContainer boots ONE instance per page and that boot is the expensive part,
 * so switching does NOT tear anything down: it wipes the shared workdir, mounts
 * the other project's files and restarts Vite. `node_modules` survives the swap
 * (see KEEP_ON_RESET in lib/webcontainer.ts), so two demos on the same
 * dependencies skip `npm install` entirely and the switch costs seconds.
 *
 * The selection lives in the URL, so a comparison can be bookmarked and reopened
 * on the same two projects.
 */

const MAX_TABS = 4;

type Status = "idle" | "loading" | "ready" | "error";

export default function CompareShell() {
  const router = useRouter();
  const params = useSearchParams();

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [ids, setIds] = useState<string[]>(() =>
    (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, MAX_TABS)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [supported, setSupported] = useState(true);
  /**
   * Bumped on every successful switch, and used as the iframe's key.
   *
   * WebContainer serves every demo from the SAME origin — the URL belongs to the
   * container's port, not to the project — so `src` is identical before and
   * after a switch and React keeps the old iframe mounted. It then shows the
   * page the previous demo left behind, or blank once its server is gone.
   * Remounting is what actually navigates it to the new demo.
   */
  const [loadNonce, setLoadNonce] = useState(0);
  // Only the newest switch may write state — clicking three tabs quickly must
  // not let the first one's server-ready overwrite the third one's preview.
  const switchRef = useRef(0);
  // The tabs the page opened with. Later changes go through the click handlers,
  // which open their own tab, so this is read once and never updated.
  const initialIds = useRef(ids);

  /** Keep the URL in step so a comparison can be shared or reopened. */
  const writeIds = useCallback(
    (next: string[]) => {
      setIds(next);
      const qs = next.length ? `?ids=${next.join(",")}` : "";
      router.replace(`/compare${qs}`, { scroll: false });
    },
    [router]
  );

  const show = useCallback(async (id: string) => {
    const mine = ++switchRef.current;
    setActiveId(id);
    setStatus("loading");
    setError("");
    setUrl("");
    setElapsedMs(null);
    const started = Date.now();
    try {
      const project = await getProject(id);
      if (mine !== switchRef.current) return;
      if (!project?.files || Object.keys(project.files).length === 0) {
        setStatus("error");
        setError("โปรเจกต์นี้ยังไม่มีไฟล์ — เปิดในสตูดิโอแล้วสั่งสร้างก่อน");
        return;
      }
      // Same treatment the studio gives a project on boot, so a demo behaves
      // here exactly as it does there.
      await prepareWorkdir(id);
      if (mine !== switchRef.current) return;
      await runProject(
        { ...sanitizeFiles(withRequiredScaffold(project.files)), "vite.config.js": VITE_CONFIG },
        {
          onPhase: () => {},
          onTerminal: () => {},
          onServerReady: (ready) => {
            if (mine !== switchRef.current) return;
            setUrl(ready);
            setLoadNonce((n) => n + 1);
            setStatus("ready");
            setElapsedMs(Date.now() - started);
          },
          onError: (message) => {
            if (mine !== switchRef.current) return;
            setStatus("error");
            setError(message);
          },
        }
      );
    } catch (e) {
      if (mine !== switchRef.current) return;
      setStatus("error");
      setError(e instanceof Error ? e.message : "เปิดโปรเจกต์ไม่สำเร็จ");
    }
  }, []);

  /**
   * Mount: check the browser, load the project list for the picker, then open
   * whichever tab the URL asked for. All of it inside one async body — the
   * pattern ShareViewer uses, and what keeps the setState calls out of the
   * effect's own scope.
   */
  useEffect(() => {
    void (async () => {
      const ok = isPreviewSupported();
      setSupported(ok);
      const list = await listProjects().catch(() => [] as ProjectSummary[]);
      setProjects(list);
      const first = initialIds.current[0];
      if (ok && first) await show(first);
    })();
  }, [show]);

  const byId = new Map((projects ?? []).map((p) => [p.id, p]));
  const tabs = ids.map((id) => ({ id, name: byId.get(id)?.name ?? "โปรเจกต์" }));

  const add = (id: string) => {
    if (ids.includes(id) || ids.length >= MAX_TABS) return;
    const next = [...ids, id];
    writeIds(next);
    setPicking(false);
    if (next.length === 1) void show(id);
  };

  const remove = (id: string) => {
    const next = ids.filter((x) => x !== id);
    writeIds(next);
    if (activeId === id) {
      setActiveId(null);
      setUrl("");
      setStatus("idle");
      if (next.length) void show(next[0]);
    }
  };

  if (!supported) {
    return (
      <Frame>
        <p className="rounded-xl border border-halt/40 bg-halt/10 px-5 py-4 text-sm text-halt">
          เบราว์เซอร์นี้ยังไม่รองรับ live preview (ต้องการ cross-origin isolation) — แนะนำ Chrome
          หรือ Edge เวอร์ชันล่าสุด
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      {/* Tab bar — one demo per tab, click to swap what the preview runs. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`group flex items-center rounded-xl border transition ${
                active
                  ? "border-shine/60 bg-shine/10"
                  : "border-night-edge bg-night hover:border-shine/40"
              }`}
            >
              <button
                onClick={() => !active && void show(t.id)}
                className={`max-w-56 truncate px-3 py-1.5 font-display text-[13px] ${
                  active ? "text-shine" : "text-chalk-dim group-hover:text-chalk"
                }`}
              >
                {active && status === "loading" && (
                  <Loader2 size={11} className="mr-1.5 inline animate-spin" />
                )}
                {t.name}
              </button>
              <button
                onClick={() => remove(t.id)}
                aria-label={`เอา ${t.name} ออก`}
                className="px-2 py-1.5 text-chalk-dim opacity-0 transition hover:text-halt group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {ids.length < MAX_TABS && (
          <button
            onClick={() => setPicking((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-night-edge px-3 py-1.5 font-display text-[13px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
          >
            <Plus size={13} /> เพิ่มระบบ
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {elapsedMs !== null && status === "ready" && (
            <span className="font-mono text-[11px] text-chalk-dim">
              สลับใน {(elapsedMs / 1000).toFixed(1)} วิ
            </span>
          )}
          {activeId && (
            <>
              <button
                onClick={() => void show(activeId)}
                title="โหลดโปรเจกต์นี้ใหม่"
                className="rounded-lg border border-night-edge p-1.5 text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
              >
                <RefreshCw size={13} />
              </button>
              <Link
                href={`/project/${activeId}`}
                title="เปิดในสตูดิโอ"
                className="rounded-lg border border-night-edge p-1.5 text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
              >
                <ExternalLink size={13} />
              </Link>
            </>
          )}
        </div>
      </div>

      {picking && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-night-edge bg-night p-1.5">
          {projects === null && (
            <p className="px-3 py-3 text-sm text-chalk-dim">
              <Loader2 size={13} className="mr-1.5 inline animate-spin" /> กำลังโหลดรายการ…
            </p>
          )}
          {projects?.length === 0 && (
            <p className="px-3 py-3 text-sm text-chalk-dim">ยังไม่มีโปรเจกต์</p>
          )}
          {projects?.map((p) => {
            const chosen = ids.includes(p.id);
            return (
              <button
                key={p.id}
                disabled={chosen}
                onClick={() => add(p.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-night-panel disabled:opacity-40"
              >
                <span className="min-w-0 flex-1 truncate text-chalk">{p.name}</span>
                <span className="font-mono text-[11px] text-chalk-dim">{p.fileCount} ไฟล์</span>
                {chosen && <Check size={13} className="text-go" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Preview */}
      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-2xl border border-night-edge bg-night">
        {ids.length === 0 ? (
          <Empty />
        ) : status === "error" ? (
          <div className="flex h-full items-center justify-center px-8">
            <p className="max-w-lg rounded-xl border border-halt/40 bg-halt/10 px-5 py-4 text-center text-sm leading-relaxed text-halt">
              {error}
            </p>
          </div>
        ) : url && status === "ready" ? (
          <iframe
            key={loadNonce}
            src={url}
            title="ระบบ"
            className="h-full w-full border-0 bg-white"
            allow="cross-origin-isolated; clipboard-write"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-chalk-dim">
            <Loader2 size={22} className="animate-spin text-shine" />
            <p className="text-sm">กำลังเปิดโปรเจกต์…</p>
            <p className="max-w-md text-center text-[12px] leading-relaxed text-chalk-dim/70">
              ระบบที่ใช้ไลบรารีชุดเดียวกันจะข้ามการติดตั้งใหม่ — สลับครั้งต่อไปจะเร็วกว่านี้มาก
            </p>
          </div>
        )}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-night px-5 py-4 text-chalk">
      <header className="mb-3 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-chalk-dim transition hover:text-chalk"
        >
          <ArrowLeft size={13} /> หน้าแรก
        </Link>
        <h1 className="font-display text-[15px] font-semibold">เทียบโปรเจกต์</h1>
        <span className="hidden font-mono text-[11px] text-chalk-dim sm:inline">
          เปิดทีละตัวในเครื่องเดียวกัน — สลับแท็บเพื่อให้ลูกค้าเห็นความต่าง
        </span>
      </header>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <MonitorSmartphone size={30} className="text-chalk-dim/50" />
      <p className="font-display text-[15px] text-chalk">เลือกโปรเจกต์มาเทียบกัน</p>
      <p className="max-w-md text-[13px] leading-relaxed text-chalk-dim">
        กด “เพิ่มระบบ” แล้วเลือกได้สูงสุด {MAX_TABS} โปรเจกต์ · เหมาะกับการโชว์ลูกค้าว่าแบบธรรมดากับ
        Premium ต่างกันตรงไหน
      </p>
    </div>
  );
}
