"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ImageOff,
  Loader2,
  ScanLine,
  Square,
  Trash2,
  X,
} from "lucide-react";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { clearShots, deleteShot, listShots, uploadShot, type Shot } from "@/lib/shots";
import { pageFiles, type ScreenNode } from "@/lib/screen-map";
import { toast } from "@/lib/toast";
import { confirm } from "@/lib/confirm";
import type { ProjectFiles } from "@/lib/types";

/**
 * The screen inventory behind a quotation: every screen of the running demo,
 * plus every modal that hangs off one, captured and named.
 *
 * The walk is driven from inside the preview (see SHOT_SCRIPT in lib/scaffold),
 * because a cross-origin iframe can be neither read nor rasterised from here.
 * Auto-driving generated UIs is inherently fragile, so a failed stop is
 * reported rather than skipped, and "แคปหน้านี้" always works by hand.
 */

interface Step {
  name: string;
  ok: boolean;
  error?: string;
}

interface ScreenInventoryProps {
  projectId: string;
  files: ProjectFiles | null;
  /** Send a message into the preview iframe (the studio owns the ref). */
  toPreview: (msg: Record<string, unknown>) => void;
  /** Preview is running — without it there is nothing to photograph. */
  ready: boolean;
  onClose: () => void;
}

export default function ScreenInventory({
  projectId,
  files,
  toPreview,
  ready,
  onClose,
}: ScreenInventoryProps) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState<"map" | "walk" | "one" | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const indexRef = useRef(0);

  const refresh = useCallback(() => {
    void listShots(projectId).then(setShots);
  }, [projectId]);

  useEffect(refresh, [refresh]);

  // Captures arrive one at a time from inside the preview.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as
        | {
            __fittShot?: boolean;
            __fittWalkStep?: boolean;
            __fittWalkDone?: boolean;
            name?: string;
            parent?: string | null;
            dataUrl?: string;
            ok?: boolean;
            error?: string;
          }
        | null;
      if (!d) return;
      if (d.__fittShot && d.dataUrl) {
        const index = indexRef.current++;
        void uploadShot(projectId, {
          name: d.name ?? "หน้าจอ",
          parent: d.parent ?? null,
          index,
          dataUrl: d.dataUrl,
        })
          .then((shot) => setShots((prev) => [...prev, shot].sort((a, b) => a.index - b.index)))
          .catch((err) =>
            toast.error("เก็บรูปไม่สำเร็จ", {
              description: err instanceof Error ? err.message : undefined,
            })
          );
      }
      if (d.__fittWalkStep) {
        setSteps((prev) => [...prev, { name: d.name ?? "?", ok: Boolean(d.ok), error: d.error }]);
      }
      if (d.__fittWalkDone) {
        setBusy(null);
        setTimeout(refresh, 800); // let the last upload land
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [projectId, refresh]);

  const scan = async () => {
    if (!files || !ready) return;
    const ok = await confirm({
      title: "สแกนหน้าจอทั้งหมด?",
      message:
        "ระบบจะไล่เปิดทีละหน้าในเดโมแล้วเก็บภาพให้เอง (รวม modal ที่เปิดจากปุ่มในหน้านั้น) — ภาพชุดเดิมจะถูกล้างก่อนเริ่ม",
      confirmLabel: "เริ่มสแกน",
    });
    if (!ok) return;

    setBusy("map");
    setSteps([]);
    try {
      const res = await fetch("/api/screen-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      const data = (await res.json()) as { screens?: ScreenNode[]; error?: string };
      if (!res.ok || !data.screens?.length) {
        toast.error("อ่านโครงสร้างหน้าจอไม่สำเร็จ", { description: data.error });
        setBusy(null);
        return;
      }
      // Say so when the map covers fewer screens than there are page files —
      // silently capturing 3 of 8 screens would poison a quotation.
      const pages = pageFiles(files).length;
      if (pages > 0 && data.screens.length < pages) {
        toast.info(`อ่านได้ ${data.screens.length} หน้า จากไฟล์หน้าจอ ${pages} ไฟล์`, {
          description: "หน้าที่ขาดไปแคปเองได้ด้วยปุ่ม “แคปหน้านี้”",
        });
      }
      await clearShots(projectId);
      setShots([]);
      indexRef.current = 0;
      setBusy("walk");
      toPreview({ __fittWalk: true, plan: data.screens });
    } catch (err) {
      toast.error("สแกนไม่สำเร็จ", { description: err instanceof Error ? err.message : undefined });
      setBusy(null);
    }
  };

  const captureOne = () => {
    if (!ready) return;
    setBusy("one");
    setSteps([]);
    indexRef.current = shots.length ? Math.max(...shots.map((s) => s.index)) + 1 : 0;
    toPreview({ __fittShotOne: true, name: `หน้าจอ ${shots.length + 1}` });
  };

  const stop = () => {
    toPreview({ __fittWalkStop: true });
    setBusy(null);
  };

  const remove = async (shot: Shot) => {
    await deleteShot(shot.path);
    setShots((prev) => prev.filter((s) => s.path !== shot.path));
  };

  const screens = shots.filter((s) => !s.parent);
  const subsOf = (name: string) => shots.filter((s) => s.parent === name);
  const orphans = shots.filter((s) => s.parent && !screens.some((x) => x.name === s.parent));

  return (
    <Overlay open onClose={onClose} placement="center">
      <GlassSurface
        strong
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-night-edge px-5 py-3">
          <Camera size={16} className="text-shine" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-semibold text-chalk">คลังหน้าจอ</h2>
            <p className="text-[11px] text-chalk-dim">
              เก็บภาพทุกหน้าจอและ modal เพื่อใช้ทำใบเสนอราคา
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-night px-2.5 py-1 font-mono text-[11px] text-chalk-dim">
            {screens.length} หน้า · {shots.length - screens.length} ย่อย
          </span>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="shrink-0 rounded-md p-1.5 text-chalk-dim transition hover:text-chalk"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-night-edge px-5 py-2.5">
          {busy === "walk" || busy === "map" ? (
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-lg border border-halt/50 px-3 py-1.5 font-display text-[12px] text-chalk transition hover:bg-halt/10"
            >
              <Square size={12} className="text-halt" /> หยุดสแกน
            </button>
          ) : (
            <button
              onClick={() => void scan()}
              disabled={!ready || !files || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-3 py-1.5 font-display text-[12px] font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
            >
              <ScanLine size={13} /> สแกนหน้าจอทั้งหมด
            </button>
          )}
          <button
            onClick={captureOne}
            disabled={!ready || busy !== null}
            title="เดินไปหน้าที่ต้องการในเดโมเอง แล้วกดปุ่มนี้"
            className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-1.5 font-display text-[12px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk disabled:opacity-40"
          >
            <Camera size={13} /> แคปหน้านี้
          </button>
          {busy && (
            <span className="inline-flex items-center gap-1.5 font-display text-[12px] text-chalk-dim">
              <Loader2 size={13} className="animate-spin text-shine" />
              {busy === "map" ? "กำลังอ่านโครงสร้างหน้าจอ…" : "กำลังเก็บภาพ…"}
            </span>
          )}
          {!ready && (
            <span className="font-display text-[12px] text-amber-300">
              ต้องให้ preview รันอยู่ก่อนถึงจะแคปได้
            </span>
          )}
        </div>

        {steps.length > 0 && (
          <div className="scroll-thin max-h-24 shrink-0 space-y-0.5 overflow-y-auto border-b border-night-edge bg-night/40 px-5 py-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                {s.ok ? (
                  <CheckCircle2 size={11} className="shrink-0 text-go" />
                ) : (
                  <ImageOff size={11} className="shrink-0 text-halt" />
                )}
                <span className={s.ok ? "text-chalk-dim" : "text-halt"}>{s.name}</span>
                {s.error && <span className="truncate text-chalk-dim/70">— {s.error}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {shots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Camera size={22} className="text-chalk-dim" />
              <p className="font-display text-sm text-chalk-dim">ยังไม่มีภาพหน้าจอ</p>
              <p className="max-w-md text-xs leading-relaxed text-chalk-dim/70">
                กด “สแกนหน้าจอทั้งหมด” แล้วระบบจะไล่เปิดทีละหน้าในเดโมเก็บภาพให้เอง
                — หน้าไหนที่ต้องกรอกข้อมูลก่อน ให้เดินเองแล้วกด “แคปหน้านี้”
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {screens.map((screen) => (
                <section key={screen.path}>
                  <ShotCard shot={screen} onZoom={setZoom} onDelete={remove} />
                  {subsOf(screen.name).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-3 border-l border-night-edge pl-4 lg:grid-cols-3">
                      {subsOf(screen.name).map((sub) => (
                        <ShotCard key={sub.path} shot={sub} small onZoom={setZoom} onDelete={remove} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {orphans.length > 0 && (
                <section>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-chalk-dim">
                    ไม่มีหน้าแม่
                  </p>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {orphans.map((s) => (
                      <ShotCard key={s.path} shot={s} small onZoom={setZoom} onDelete={remove} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </GlassSurface>
      {zoom && <ImageLightbox src={zoom} onClose={() => setZoom(null)} />}
    </Overlay>
  );
}

function ShotCard({
  shot,
  small,
  onZoom,
  onDelete,
}: {
  shot: Shot;
  small?: boolean;
  onZoom: (url: string) => void;
  onDelete: (shot: Shot) => Promise<void>;
}) {
  return (
    <div className="group overflow-hidden rounded-xl border border-night-edge bg-night">
      <button onClick={() => onZoom(shot.url)} className="block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.url}
          alt={shot.name}
          className={`w-full object-cover object-top transition group-hover:opacity-90 ${
            small ? "h-28" : "h-56"
          }`}
        />
      </button>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-display text-[12px] text-chalk">
          {shot.name}
        </span>
        <button
          onClick={() => void onDelete(shot)}
          aria-label="ลบภาพนี้"
          className="shrink-0 text-chalk-dim opacity-0 transition hover:text-halt group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
