"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

/**
 * A new partner's first look at the home page: what to do first, in the order
 * the app needs it. Partner status lands on a workspace, so the workspace comes
 * before the project, and the letterhead is saved from inside a project's
 * quotation. Closing it is stored with the partner (migration 0061), so it does
 * not come back on another device.
 *
 * A dialog rather than a card in the hero: the hero is one screen tall with its
 * overflow hidden, and on a small phone a card that size pushes its top edge,
 * close button included, out of sight.
 */
const STEPS = [
  {
    title: "สร้าง workspace ของบริษัทคุณ",
    body: "กดช่อง “ส่วนตัว” ที่มุมซ้ายบนของกล่องพิมพ์บนหน้าแรก แล้วเลือก “สร้าง workspace ใหม่” สิทธิ์ Partner อยู่กับ workspace นี้",
  },
  {
    title: "เริ่มโปรเจกต์แรกใน workspace นั้น",
    body: "เลือก workspace นั้นในช่องเดิม พิมพ์สิ่งที่ลูกค้าอยากได้เป็นภาษาไทย แล้วกดเริ่ม",
  },
  {
    title: "ใส่โลโก้และข้อมูลบริษัทครั้งเดียว",
    body: "ในโปรเจกต์ เปิดหน้าใบเสนอราคา กรอกหัวกระดาษ แล้วกด “บันทึกเป็นค่าเริ่มต้น” ใบถัดไปจะขึ้นให้เอง",
  },
];

export default function PartnerWelcome() {
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    void createClient()
      .rpc("fittbuilder_partner_welcome")
      .then(({ data, error }) => {
        if (error) {
          console.error("[partner-welcome] check failed:", error.message);
          return;
        }
        if (alive) setShow(data);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function close() {
    setClosing(true);
    const { error } = await createClient().rpc("fittbuilder_partner_welcome_done");
    setClosing(false);
    if (error) {
      toast.error("ปิดไม่สำเร็จ", { description: error.message });
      return;
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-welcome-title"
        className="glass-strong relative max-h-[calc(100dvh-2rem)] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl border border-night-edge p-5 shadow-2xl sm:p-6"
      >
        <button
          onClick={() => void close()}
          disabled={closing}
          aria-label="ปิด"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-chalk/60 transition hover:bg-chalk/10 hover:text-chalk disabled:opacity-40"
        >
          <X size={16} />
        </button>

        <p className="inline-flex items-center gap-1.5 text-[13px] text-go">
          <BadgeCheck size={14} /> คุณเป็น Partner แล้ว
        </p>
        <h2
          id="partner-welcome-title"
          className="mt-1.5 pr-8 font-display text-lg font-semibold text-chalk"
        >
          เริ่มใช้ FITT Builder ในนามบริษัทคุณ
        </h2>

        <ol className="mt-4 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-shine/50 font-mono text-[12px] text-shine">
                {i + 1}
              </span>
              <div>
                <p className="text-[14px] font-medium text-chalk">
                  {step.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-chalk-dim">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={() => void close()}
          disabled={closing}
          className="mt-5 rounded-full bg-shine px-4 py-2 font-display text-[13px] font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
        >
          {closing ? "กำลังปิด…" : "เข้าใจแล้ว"}
        </button>
      </section>
    </div>
  );
}
