"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Radio,
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
import { pageFiles, type ScreenMap } from "@/lib/screen-map";
import { SHOT_BRIDGE_VERSION } from "@/lib/scaffold";
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
  /** Recording runs with this panel closed, so the studio owns the state. */
  recording: boolean;
  onStartRecording: () => void;
  files: ProjectFiles | null;
  /** Send a message into the preview iframe (the studio owns the ref). */
  toPreview: (msg: Record<string, unknown>) => void;
  /** Preview is running — without it there is nothing to photograph. */
  ready: boolean;
  onClose: () => void;
}

export default function ScreenInventory({
  projectId,
  recording,
  onStartRecording,
  files,
  toPreview,
  ready,
  onClose,
}: ScreenInventoryProps) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState<"map" | "walk" | "one" | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  // The capture script lives in the container's vite.config, which is only
  // rewritten on mount — a studio tab left open keeps running an old copy, and
  // a fix then looks like it changed nothing. Ask the preview which build it is.
  // Both pieces are written only from async callbacks (the reply, the timeout),
  // and the verdict is derived — no state is set while the effect body runs.
  const [pongVersion, setPongVersion] = useState<number | null>(null);
  const [pingTimedOut, setPingTimedOut] = useState(false);
  const [probe, setProbe] = useState(0);
  const indexRef = useRef(0);
  const bridge: "checking" | "ok" | "stale" =
    pongVersion !== null
      ? pongVersion >= SHOT_BRIDGE_VERSION
        ? "ok"
        : "stale"
      : pingTimedOut
        ? "stale"
        : "checking";

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const onPong = (e: MessageEvent) => {
      const d = e.data as { __fittShotPong?: boolean; v?: number } | null;
      if (d?.__fittShotPong && alive) setPongVersion(d.v ?? 0);
    };
    window.addEventListener("message", onPong);
    toPreview({ __fittShotPing: true });
    const timer = setTimeout(() => {
      if (alive) setPingTimedOut(true);
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("message", onPong);
    };
  }, [ready, toPreview, probe]);

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
            from?: string | null;
            via?: string | null;
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
          from: d.from ?? null,
          via: d.via ?? null,
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

  /**
   * @param fromHere Skip the gates and walk from wherever the preview already
   *   is. Sign-in flows vary wildly (pick an account, then submit, then choose a
   *   company…); when the automatic pass cannot get through, the user logging in
   *   themselves is faster than another round of guessing.
   */
  const scan = async (fromHere = false) => {
    if (!files || !ready) return;
    const ok = await confirm({
      title: fromHere ? "สแกนต่อจากหน้านี้?" : "สแกนหน้าจอทั้งหมด?",
      message: fromHere
        ? "ระบบจะเริ่มเดินจากหน้าที่เปิดอยู่ตอนนี้ โดยข้ามขั้นตอนเข้าสู่ระบบ/เลือกบริษัท — ใช้เมื่อคุณล็อกอินเองแล้ว · ภาพชุดเดิมจะถูกล้างก่อนเริ่ม"
        : "ระบบจะไล่เปิดทีละหน้าในเดโมแล้วเก็บภาพให้เอง (รวม modal ที่เปิดจากปุ่มในหน้านั้น) — ภาพชุดเดิมจะถูกล้างก่อนเริ่ม",
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
      const data = (await res.json()) as Partial<ScreenMap> & { error?: string };
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
      // Gates (sign-in, company picker) run first — without them every nav click
      // lands on the same page and the walk photographs it over and over.
      toPreview({
        __fittWalk: true,
        plan: data.screens,
        setup: fromHere ? [] : (data.setup ?? []),
        // The app's own vocabulary for "go on" / "get out", added on top of the
        // walker's built-in list so a non-Thai demo is not left guessing.
        words: { forward: data.forward ?? [], avoid: data.avoid ?? [] },
      });
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

  const failed = steps.filter((s) => !s.ok);
  const screens = shots.filter((s) => !s.parent);
  const subsOf = (name: string) => shots.filter((s) => s.parent === name);
  const orphans = shots.filter((s) => s.parent && !screens.some((x) => x.name === s.parent));

  return (
    <Overlay open onClose={onClose} placement="center">
      <GlassSurface
        strong
        className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl"
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
            <>
              <button
                onClick={() => void scan()}
                disabled={!ready || !files || busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-3 py-1.5 font-display text-[12px] font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
              >
                <ScanLine size={13} /> สแกนหน้าจอทั้งหมด
              </button>
              <button
                onClick={() => void scan(true)}
                disabled={!ready || !files || busy !== null}
                title="ล็อกอิน/เลือกบริษัทเองในพรีวิวก่อน แล้วกดปุ่มนี้ให้ระบบเดินต่อจากหน้านั้น"
                className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-1.5 font-display text-[12px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk disabled:opacity-40"
              >
                <ScanLine size={13} /> สแกนต่อจากหน้านี้
              </button>
            </>
          )}
          <button
            onClick={() => {
              indexRef.current = shots.length ? Math.max(...shots.map((x) => x.index)) + 1 : 0;
              onStartRecording();
            }}
            disabled={!ready || busy !== null || recording}
            title="กดแล้วใช้เดโมตามปกติ — ระบบเก็บทุกหน้าที่เปลี่ยนพร้อมจำว่ามาจากปุ่มไหน"
            className="inline-flex items-center gap-1.5 rounded-lg bg-halt px-3 py-1.5 font-display text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            <Radio size={13} /> อัดการใช้งาน
          </button>
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

        {ready && bridge === "stale" && (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-amber-400/40 bg-amber-400/10 px-5 py-2">
            <span className="shrink-0 font-mono text-[11px] font-semibold text-amber-300">
              ⚠ สคริปต์ในพรีวิวเป็นเวอร์ชันเก่า
            </span>
            <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-200/90">
              ตัวแคปฝังอยู่ในไฟล์ตั้งค่าของคอนเทนเนอร์ ซึ่งเขียนใหม่ตอนบูตเท่านั้น —
              <b> โหลดหน้า studio ใหม่ (F5)</b> ก่อนสแกน ไม่งั้นจะได้ผลเหมือนเดิม
            </span>
            <button
              onClick={() => {
                setPongVersion(null);
                setPingTimedOut(false);
                setProbe((n) => n + 1);
              }}
              className="shrink-0 rounded-md border border-amber-400/50 px-2 py-0.5 font-display text-[11px] text-amber-100 transition hover:bg-amber-400/20"
            >
              ตรวจอีกครั้ง
            </button>
          </div>
        )}

        {/* A wall of green ticks buries the two lines that need attention —
            summarise, and open on the failures. */}
        {steps.length > 0 && (
          <div className="shrink-0 border-b border-night-edge bg-night/40 px-5 py-2">
            <button
              onClick={() => setStepsOpen((v) => !v)}
              className="flex w-full items-center gap-2 font-mono text-[11px] text-chalk-dim transition hover:text-chalk"
            >
              <CheckCircle2 size={11} className="shrink-0 text-go" />
              <span className="text-go">{steps.filter((s) => s.ok).length} สำเร็จ</span>
              {failed.length > 0 && (
                <>
                  <ImageOff size={11} className="shrink-0 text-halt" />
                  <span className="text-halt">{failed.length} ไม่สำเร็จ</span>
                </>
              )}
              <span className="ml-auto">{stepsOpen ? "ซ่อน" : "ดูรายละเอียด"}</span>
            </button>
            {(stepsOpen || (failed.length > 0 && !busy)) && (
              <div className="scroll-thin mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
                {(stepsOpen ? steps : failed).map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 font-mono text-[11px] leading-relaxed">
                    {s.ok ? (
                      <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-go" />
                    ) : (
                      <ImageOff size={11} className="mt-0.5 shrink-0 text-halt" />
                    )}
                    <span className={s.ok ? "shrink-0 text-chalk-dim" : "shrink-0 text-halt"}>
                      {s.name}
                    </span>
                    {s.error && <span className="text-chalk-dim/70">— {s.error}</span>}
                  </div>
                ))}
              </div>
            )}
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
            /* A grid, not a column of posters: the point of this screen is to
               see the whole inventory at once and count it. */
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {screens.map((screen, i) => (
                <ShotCard
                  key={screen.path}
                  index={i + 1}
                  shot={screen}
                  subs={subsOf(screen.name)}
                  onZoom={setZoom}
                  onDelete={remove}
                />
              ))}
              {orphans.map((s) => (
                <ShotCard key={s.path} shot={s} subs={[]} onZoom={setZoom} onDelete={remove} />
              ))}
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
  subs,
  index,
  onZoom,
  onDelete,
}: {
  shot: Shot;
  /** Modals hanging off this screen, shown as a strip inside its card. */
  subs: Shot[];
  index?: number;
  onZoom: (url: string) => void;
  onDelete: (shot: Shot) => Promise<void>;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-night-edge bg-night">
      <button onClick={() => onZoom(shot.url)} className="relative block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.url}
          alt={shot.name}
          className="h-36 w-full bg-white object-cover object-top transition group-hover:opacity-90"
        />
        {index !== undefined && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-night/85 px-1.5 py-0.5 font-mono text-[10px] text-chalk-dim">
            {String(index).padStart(2, "0")}
          </span>
        )}
      </button>

      <div className="flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-display text-[12px] text-chalk" title={shot.name}>
          {shot.name}
          {shot.via && (
            <span className="block truncate font-mono text-[10px] text-chalk-dim" title={`มาจากการกด “${shot.via}”`}>
              ← {shot.via}
            </span>
          )}
        </span>
        {subs.length > 0 && (
          <span className="shrink-0 rounded-full bg-shine/15 px-1.5 py-0.5 font-mono text-[10px] text-shine">
            +{subs.length}
          </span>
        )}
        <button
          onClick={() => void onDelete(shot)}
          aria-label="ลบภาพนี้"
          className="shrink-0 text-chalk-dim opacity-0 transition hover:text-halt group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {subs.length > 0 && (
        <div className="scroll-thin flex gap-1.5 overflow-x-auto border-t border-night-edge px-3 py-2">
          {subs.map((sub) => (
            <button
              key={sub.path}
              onClick={() => onZoom(sub.url)}
              title={sub.via ? `${sub.name} — กด “${sub.via}”` : sub.name}
              className="shrink-0 overflow-hidden rounded-md border border-night-edge transition hover:border-shine/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sub.url} alt={sub.name} className="h-12 w-20 bg-white object-cover object-top" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
