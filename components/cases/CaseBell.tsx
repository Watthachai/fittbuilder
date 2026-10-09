"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Loader2, Plus } from "lucide-react";
import { isClosed, type CaseSummary } from "@/lib/cases";
import { listCases } from "@/lib/cases-client";
import { useDismiss } from "@/lib/useDismiss";
import { useCaseInbox } from "./CaseInbox";
import { StatusPill } from "./CaseBits";
import ReportCaseModal from "./ReportCaseModal";

const SHOWN = 8;

type Permission = NotificationPermission | "unsupported";

/**
 * "เคสของฉัน" from any page: the number of cases waiting on you, and a panel
 * with your open cases, a way to report a new one, and desktop notifications.
 * `newTab` opens cases in a new tab — the studio may be in the middle of a build.
 * `align` is the edge the panel opens from: "left" in the settings sidebar, which sits at the screen's left.
 */
export default function CaseBell({ newTab = false, align = "right" }: { newTab?: boolean; align?: "left" | "right" }) {
  const { signedIn, alerts } = useCaseInbox();
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [team, setTeam] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [permission, setPermission] = useState<Permission>("unsupported");
  const root = useRef<HTMLDivElement>(null);

  // Close on Escape, and on a press anywhere outside. Not a fixed scrim: headers
  // with backdrop-blur make `fixed` relative to themselves, so a scrim would not
  // cover the page.
  useDismiss(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  // Read the list each time the panel opens, and again when an alert arrives while it is open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void listCases("all")
      .then((res) => {
        if (!alive) return;
        setTeam(res.team);
        setCases(res.cases);
      })
      .catch(() => {
        if (alive) setCases([]);
      });
    return () => {
      alive = false;
    };
  }, [open, alerts]);

  if (!signedIn) return null;

  const count = alerts.length;
  const shown = (cases ?? [])
    .filter((c) => !isClosed(c.status) || c.unread)
    .sort((a, b) => Number(b.unread) - Number(a.unread) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, SHOWN);
  const target = newTab ? { target: "_blank", rel: "noreferrer" } : {};

  const allow = async () => setPermission(await Notification.requestPermission());

  return (
    <div ref={root} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `เคสของฉัน มี ${count} เคสที่รอคุณ` : "เคสของฉัน"}
        title="เคสของฉัน"
        className={`relative grid h-8 w-8 place-items-center rounded-full transition ${
          open ? "bg-chalk/10 text-chalk" : "text-chalk-dim hover:bg-chalk/5 hover:text-chalk"
        }`}
      >
        {count ? <BellRing size={16} /> : <Bell size={16} />}
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 font-mono text-[9px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className={`absolute top-full z-50 mt-2 w-80 ${align === "right" ? "right-0" : "left-0"} overflow-hidden rounded-xl border border-night-edge bg-night-panel shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-night-edge px-3.5 py-2.5">
              <p className="font-display text-[13px] font-semibold text-chalk">{team ? "เคสที่ยังไม่ปิด" : "เคสของฉัน"}</p>
              {count > 0 && <p className="text-[11px] text-red-400">รอคุณ {count} เคส</p>}
            </div>

            <div className="scroll-thin max-h-80 overflow-y-auto py-1">
              {cases === null ? (
                <p className="flex items-center gap-2 px-3.5 py-4 text-[12px] text-chalk-dim">
                  <Loader2 size={13} className="animate-spin" /> กำลังโหลด…
                </p>
              ) : shown.length === 0 ? (
                <p className="px-3.5 py-4 text-[12px] leading-relaxed text-chalk-dim">
                  ยังไม่มีเคสที่เปิดอยู่ เจอปัญหาตรงไหนกดแจ้งได้เลยครับ
                </p>
              ) : (
                shown.map((c) => (
                  <Link
                    key={c.id}
                    href={`/cases?id=${c.id}`}
                    {...target}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-3.5 py-2.5 transition hover:bg-chalk/5"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.unread ? "bg-red-500" : "bg-transparent"}`}
                      aria-label={c.unread ? "มีอัปเดตใหม่" : undefined}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-chalk">
                        <span className="font-mono text-chalk-dim">#{c.number}</span> {c.title}
                      </span>
                      <span className="mt-1 block">
                        <StatusPill status={c.status} />
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-night-edge px-3 py-2.5">
              <button
                onClick={() => {
                  setOpen(false);
                  setReporting(true);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-shine px-3 py-1.5 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
              >
                <Plus size={13} /> แจ้งเคสใหม่
              </button>
              <Link
                href="/cases"
                {...target}
                onClick={() => setOpen(false)}
                className="font-display text-[12px] text-chalk-dim transition hover:text-chalk"
              >
                ดูเคสทั้งหมด
              </Link>
            </div>

            {permission !== "unsupported" && (
              <div className="border-t border-night-edge px-3.5 py-2.5 text-[11px] leading-relaxed text-chalk-dim">
                {permission === "default" ? (
                  <button onClick={() => void allow()} className="text-shine transition hover:underline">
                    เปิดแจ้งเตือนบนเดสก์ท็อป เมื่อทีมตอบระหว่างเปิดแท็บอื่นอยู่
                  </button>
                ) : permission === "granted" ? (
                  "แจ้งเตือนบนเดสก์ท็อปเปิดอยู่"
                ) : (
                  "เบราว์เซอร์ปิดการแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์"
                )}
              </div>
            )}
          </div>
        </>
      )}

      {reporting && <ReportCaseModal preset={{ kind: "other" }} onClose={() => setReporting(false)} />}
    </div>
  );
}
