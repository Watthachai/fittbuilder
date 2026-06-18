"use client";

import { useEffect, useState } from "react";
import type { GenerationPhase } from "@/lib/types";

/** Phase → headline shown above the loader. */
const PHASE_TITLE: Record<GenerationPhase, string> = {
  idle: "กำลังเตรียมเวที…",
  generating: "AI กำลังเขียนโค้ด…",
  installing: "กำลังติดตั้ง dependencies…",
  starting: "กำลังเปิด dev server…",
  ready: "พร้อมแล้ว",
  error: "เกิดข้อผิดพลาด",
};

/** Rotating tips, AI-Studio style ("Enjoy these tips while you wait"). */
const TIPS = [
  "พิมพ์ภาษาธรรมดาได้เลย เช่น “เพิ่มปุ่มเข้าสู่ระบบ” หรือ “เปลี่ยนสีหลักเป็นเขียว”",
  "กดแท็บ Code เพื่อดูและแก้ไฟล์ทั้งหมดได้โดยตรง",
  "AI ติดตั้ง npm package ที่ต้องใช้ให้อัตโนมัติ — ไม่ต้องพิมพ์ install เอง",
  "ใช้ปุ่มมือถือ/แท็บเล็ตด้านบน เพื่อดูว่าเว็บหน้าตาเป็นยังไงบนจอเล็ก",
  "บอกให้ละเอียดขึ้น เช่น “ตารางสินค้า มีค้นหา + แบ่งหน้า” จะได้ผลตรงใจกว่า",
  "กด Share เพื่อส่งลิงก์ให้คนอื่นเปิดดู demo ได้ทันที",
];

const TIP_INTERVAL_MS = 4500;

export default function BuildingLoader({ phase }: { phase: GenerationPhase }) {
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex w-full max-w-md flex-col items-center justify-center gap-6 self-center px-8 text-center">
      <div className="relative w-56">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cat_playing_animation.svg"
          alt=""
          className="loader-float w-full select-none opacity-90"
          draggable={false}
        />
      </div>

      <div>
        <p className="font-display text-[15px] text-chalk">{PHASE_TITLE[phase]}</p>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" style={{ animationDelay: "0ms" }} />
          <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" style={{ animationDelay: "150ms" }} />
          <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" style={{ animationDelay: "300ms" }} />
        </div>
      </div>

      <div className="w-full rounded-xl border border-night-edge bg-night-panel px-5 py-4">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-shine">เคล็ดลับ</p>
        <p key={tip} className="tip-fade text-[13px] leading-relaxed text-chalk-dim">
          {TIPS[tip]}
        </p>
      </div>
    </div>
  );
}
