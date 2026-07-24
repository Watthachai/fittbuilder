"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  FileText,
  Menu,
  Play,
  Radar,
  Stethoscope,
  X,
} from "lucide-react";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
];

const VIDEO_SRC = "https://strvid.nyc3.cdn.digitaloceanspaces.com/motionsite/hero_robo_video.mp4";

/**
 * FITT Consult landing — a deliberate light-theme island (per its design
 * blueprint): white canvas, electric-blue brand, liquid-glass surfaces,
 * floating task badges breathing around the hero video. The working app
 * lives at /consult/app.
 */
export default function ConsultLanding() {
  const [drawer, setDrawer] = useState(false);

  return (
    <main
      className="relative min-h-screen overflow-x-clip bg-white text-black"
      style={{ colorScheme: "light", fontFamily: "var(--font-sans), Inter, ui-sans-serif" }}
    >
      {/* Ambient aura */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-[8%] h-[420px] w-[420px] rounded-full bg-[#60B1FF]/20 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[4%] top-[30%] h-[380px] w-[380px] rounded-full bg-[#319AFF]/20 blur-[120px]"
      />

      {/* Floating liquid-glass nav */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="pointer-events-none fixed left-0 right-0 top-[30px] z-50 flex justify-center px-4"
      >
        <div className="pointer-events-auto flex h-12 w-full max-w-[1280px] items-center justify-between gap-8 rounded-[16px] px-6 py-2 transition-all duration-300">
          <Link
            href="/consult"
            className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight text-black"
            style={{ fontFamily: "var(--font-fustat), Inter, sans-serif" }}
          >
            <Bot className="h-6 w-6 text-[#0084FF]" />
            FITT Consult
            <span className="rounded-full bg-[#0084FF]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#0084FF]">
              alpha
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/"
              className="text-[14px] font-medium text-black/60 transition-colors hover:text-black"
            >
              FITT Builder
            </Link>
            <Link
              href="/consult/app"
              className="group flex h-9 items-center gap-2 rounded-[12px] border border-black/10 bg-black/5 px-5 text-[14px] font-semibold text-black transition-all hover:bg-black/10 hover:shadow-md"
            >
              เข้าใช้งาน
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button
            onClick={() => setDrawer(true)}
            aria-label="เมนู"
            className="grid h-9 w-9 place-items-center rounded-[12px] border border-black/10 bg-black/5 text-black md:hidden"
          >
            <Menu className="h-4.5 w-4.5" size={18} />
          </button>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-[60] bg-black/20 md:hidden"
            />
            <motion.div
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="fixed bottom-0 right-0 top-0 z-[70] flex w-[260px] flex-col gap-1 border-l border-black/10 bg-white/95 p-6 pt-20 backdrop-blur-[40px] md:hidden"
            >
              <button
                onClick={() => setDrawer(false)}
                aria-label="ปิดเมนู"
                className="absolute right-5 top-6 text-black/50 transition hover:text-black"
              >
                <X size={20} />
              </button>
              <Link
                href="/"
                onClick={() => setDrawer(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-black/70 transition hover:bg-black/5 hover:text-black"
              >
                FITT Builder
              </Link>
              <Link
                href="/consult/app"
                onClick={() => setDrawer(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-[12px] bg-[#0084FF] px-5 py-2.5 text-[14px] font-semibold text-white"
              >
                เข้าใช้งาน <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero */}
      <div className="mx-auto w-full max-w-[1280px] px-6 pt-[80px] sm:px-12 lg:px-20">
        <div className="grid grid-cols-1 gap-10 pt-14 lg:grid-cols-12 lg:gap-12">
          {/* Left column */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
            className="flex max-w-[620px] flex-col items-start justify-center text-left lg:col-span-5 lg:pr-6"
          >
            {/* Honest alpha badge (no invented numbers) */}
            <div className="flex w-fit items-center gap-3 rounded-full border border-black/5 bg-black/5 px-3 py-1.5 shadow-xs">
              <span aria-hidden className="flex -space-x-2 select-none">
                {AVATARS.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-6 w-6 rounded-full border-[1.5px] border-white object-cover transition-transform hover:-translate-y-0.5"
                  />
                ))}
              </span>
              <span className="text-[12px] text-black/80">
                <b className="text-neutral-900">Alpha</b> — ทีมแรกๆ กำลังทดลองใช้
              </span>
            </div>

            <h1
              className="mt-6 select-none text-[36px] font-black leading-[1.08] tracking-[-3px] text-black sm:text-[44px] lg:text-[60px]"
              style={{ fontFamily: "var(--font-outfit), Inter, sans-serif" }}
            >
              Your All-in-One
              <br />
              Business Consult.
            </h1>

            <p className="mt-5 max-w-[480px] text-[18px] leading-relaxed tracking-[-0.5px] text-black/60">
              วางข้อมูลจริงขององค์กร — เสียงลูกค้า งบ ตัวเลขขาย — แล้วให้ AI
              หา Pain Point และตรวจสุขภาพธุรกิจ พร้อมที่มาอ้างอิงทุกข้อสรุป
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/consult/app"
                  className="group flex w-fit items-center gap-4 rounded-[16px] bg-[#0084FF] py-2 pl-6 pr-2 text-sm font-bold text-white transition-all hover:bg-[#0074E0]"
                  style={{
                    boxShadow:
                      "inset 0px 4px 4px 0px rgba(255,255,255,0.35), 0 10px 25px -5px rgba(0, 132, 255, 0.25)",
                  }}
                >
                  เริ่มใช้ FITT Consult
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0084FF] transition-transform group-hover:translate-x-0.5">
                    <ChevronRight size={16} />
                  </span>
                </Link>
              </motion.div>

              <Link href="/consult/app" className="group flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-blue-50 transition-colors group-hover:bg-blue-100">
                  <Play size={13} className="fill-[#0084FF] text-[#0084FF]" />
                </span>
                <span className="text-[14px] font-bold text-[#0084FF] transition-colors group-hover:text-[#0074E0]">
                  ดูตัวอย่างรายงาน
                </span>
              </Link>
            </div>
          </motion.section>

          {/* Right column */}
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.3 }}
            className="pointer-events-none relative flex w-full items-center justify-center py-10 lg:col-span-7 lg:justify-end"
          >
            {/* Orbit aura + rings */}
            <div
              aria-hidden
              className="absolute left-[20%] top-[30%] -z-10 h-[420px] w-[420px] animate-pulse rounded-full bg-sky-400/15 blur-[110px] duration-[7000ms]"
            />
            <svg
              aria-hidden
              viewBox="0 0 620 620"
              className="absolute left-1/2 top-1/2 -z-10 h-[620px] w-[620px] -translate-x-1/2 -translate-y-[52%] opacity-35"
            >
              <defs>
                <linearGradient id="consult-orbit" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#60B1FF" />
                  <stop offset="100%" stopColor="#319AFF" />
                </linearGradient>
              </defs>
              <circle cx="310" cy="310" r="300" fill="none" stroke="url(#consult-orbit)" strokeWidth="1" strokeDasharray="3 10" />
              <circle cx="310" cy="310" r="240" fill="none" stroke="url(#consult-orbit)" strokeWidth="1" strokeDasharray="2 8" />
              <circle cx="310" cy="310" r="180" fill="none" stroke="url(#consult-orbit)" strokeWidth="1" strokeDasharray="1 6" />
            </svg>

            <div className="relative w-full max-w-[600px]">
              <video
                src={VIDEO_SRC}
                autoPlay
                loop
                muted
                playsInline
                controls={false}
                className="block w-full select-none rounded-[24px]"
                style={{ filter: "brightness(1.02) contrast(1.04)" }}
              />

              {/* Floating badge: Pain Point (top right) */}
              <FloatingBadge
                className="absolute -right-4 top-[18%] sm:-right-10 md:-right-14"
                float={{ y: [0, -8, 0], x: [0, 2, 0], duration: 5.0, rotate: 1 }}
                delay={0.6}
                iconBg="from-[#0084FF] to-[#0066CC]"
                iconShadow="0 4px 12px rgba(0,132,255,0.3)"
                cardShadow="0 12px 32px -4px rgba(0,132,255,0.12)"
                icon={<Radar size={15} className="text-white" />}
                title="หา Pain Point"
                sub="จากเสียงลูกค้าจริง"
              />

              {/* Floating badge: P&L (center left) */}
              <FloatingBadge
                className="absolute -left-6 top-[48%] sm:-left-12 md:-left-16"
                float={{ y: [0, 8, 0], x: [0, -2, 0], duration: 5.5, rotate: -1 }}
                delay={0.8}
                iconBg="from-[#10B981] to-[#059669]"
                iconShadow="0 4px 12px rgba(16,185,129,0.3)"
                cardShadow="0 12px 32px -4px rgba(16,185,129,0.12)"
                icon={<FileText size={15} className="text-white" />}
                title="อ่านงบให้ขาด"
                sub="แยกส่วนลด เห็นกำไรจริง"
              />

              {/* Floating badge: Health check (bottom right) */}
              <FloatingBadge
                className="absolute -right-4 bottom-[18%] sm:-right-8 md:-right-12"
                float={{ y: [0, -10, 0], x: [0, -1, 0], duration: 4.8, rotate: 1.5 }}
                delay={1.0}
                iconBg="from-[#9333EA] to-[#7E22CE]"
                iconShadow="0 4px 12px rgba(147,51,234,0.3)"
                cardShadow="0 12px 32px -4px rgba(147,51,234,0.12)"
                icon={<Stethoscope size={15} className="text-white" strokeWidth={3} />}
                title="ตรวจสุขภาพธุรกิจ"
                sub="ครบ 5 ด้านสำคัญ"
              />
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}

/** Liquid-glass task badge that breathes on a slow sine loop (per blueprint). */
function FloatingBadge({
  className,
  float,
  delay,
  iconBg,
  iconShadow,
  cardShadow,
  icon,
  title,
  sub,
}: {
  className: string;
  float: { y: number[]; x: number[]; duration: number; rotate: number };
  delay: number;
  iconBg: string;
  iconShadow: string;
  cardShadow: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 100, delay }}
      className={className}
    >
      <motion.div
        animate={{ y: float.y, x: float.x }}
        transition={{ duration: float.duration, ease: "easeInOut", repeat: Infinity }}
        whileHover={{ scale: 1.05, rotate: float.rotate }}
        className="pointer-events-auto flex items-center gap-3 rounded-[20px] border border-white/70 bg-gradient-to-br from-white/75 to-white/45 px-5 py-3 ring-1 ring-black/5 backdrop-blur-[20px]"
        style={{ boxShadow: `inset 0 2.5px 4px rgba(255,255,255,0.8), ${cardShadow}` }}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${iconBg}`}
          style={{ boxShadow: iconShadow }}
        >
          {icon}
        </span>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-[13px] font-black tracking-tight text-neutral-900">{title}</span>
          <span className="mt-0.5 text-[10px] font-semibold text-neutral-500">{sub}</span>
        </span>
      </motion.div>
    </motion.div>
  );
}
