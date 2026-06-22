import Link from "next/link";
import { ArrowRight, ArrowUpRight, FolderOpen } from "lucide-react";
import LaunchPad from "@/components/landing/LaunchPad";
import AccountMenu from "@/components/AccountMenu";
import { PRESETS } from "@/lib/presets";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4";

const NAV_LINKS = [
  { label: "เริ่มสร้าง", href: "#launch" },
  { label: "วิธีใช้", href: "#how" },
  { label: "Spec-to-Demo", href: "#spec" },
  { label: "ราคา", href: "#pricing" },
];

const STEPS = [
  {
    no: "01",
    title: "พิมพ์สิ่งที่อยากได้",
    body: "ภาษาไทยหรืออังกฤษก็ได้ — อธิบายเหมือนเล่าให้เพื่อนฟัง ไม่ต้องรู้ศัพท์เทคนิค",
  },
  {
    no: "02",
    title: "AI เขียนโค้ดและรันให้ดู",
    body: "โค้ดจริง รันจริงใน browser ของคุณ — เห็นทุกขั้นตอน Generating → Installing → Ready",
  },
  {
    no: "03",
    title: "แก้ด้วยภาษาธรรมดา แล้วแชร์",
    body: "“เปลี่ยนสีปุ่มเป็นน้ำเงิน” แล้ว AI แก้ให้ เสร็จแล้วส่งลิงก์ให้ใครดูก็ได้ ไม่ต้อง login",
  },
];

const TIERS = [
  { name: "Free", price: "฿0", per: "/เดือน", features: ["5 generations/เดือน", "Public projects", "Shareable link"], hot: false },
  { name: "Pro", price: "฿299", per: "/เดือน", features: ["50 generations/เดือน", "Private projects", "Export code (.zip)", "Custom domain"], hot: true },
  { name: "Business", price: "฿899", per: "/เดือน", features: ["Unlimited generations", "Team workspace", "Priority AI", "White-label"], hot: false },
];

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white">
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight text-white">
        FITT Builder
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* ——— Full-screen video hero ——— */}
      <section className="relative flex h-screen flex-col overflow-hidden">
        <video
          src={HERO_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Legibility scrim over the video */}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

        <div className="relative z-10 flex h-full flex-col">
          {/* Nav */}
          <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
            <Logo />
            <div className="flex items-center gap-3">
              <nav className="hidden items-center gap-1 rounded-full border border-night-edge bg-black/30 px-2 py-1.5 backdrop-blur-sm lg:flex">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-full px-4 py-1.5 text-sm text-white/80 transition hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/projects"
                  className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm text-white/80 transition hover:text-white"
                >
                  ผลงานของฉัน <ArrowUpRight size={14} />
                </Link>
              </nav>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 text-sm text-white/80 transition hover:text-white lg:hidden"
              >
                <FolderOpen size={16} /> ผลงานของฉัน
              </Link>
              <AccountMenu />
            </div>
          </header>

          {/* Two-column intro row */}
          <div className="mx-auto grid w-full max-w-7xl gap-4 px-6 pt-6 lg:grid-cols-2">
            <p className="rise rise-1 max-w-md text-sm text-white/80 md:text-base">
              เราเปลี่ยนไอเดียและเอกสาร BRD/PRD ของคุณให้เป็น web demo
              ที่คลิกได้จริง — โดยไม่ต้องเขียนโค้ดแม้แต่บรรทัดเดียว
            </p>
            <p className="rise rise-2 text-sm text-white/80 md:text-base lg:text-right">
              จาก Prompt สู่เว็บจริง ภายใน 60 วินาที !
            </p>
          </div>

          {/* Hero center */}
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="rise rise-2 text-xs uppercase tracking-tight text-white/80 md:text-sm">
              AI Web Demo Builder — รองรับ Prompt ไทยและอังกฤษ
            </p>
            <h1 className="rise rise-3 mt-4 font-display text-5xl leading-[0.85] tracking-tighter sm:text-7xl lg:text-8xl xl:text-9xl">
              <span className="block font-medium text-white">Prompt in.</span>
              <span className="shiny-text block font-medium">Demo out.</span>
            </h1>
            <a
              href="#launch"
              className="rise rise-4 group mt-10 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-gray-900 md:px-8 md:py-4 md:text-base"
            >
              เริ่มสร้างเลย — ฟรี
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      <main>
        {/* Launch pad */}
        <section id="launch" className="mx-auto flex max-w-7xl flex-col items-center px-6 py-20">
          <h2 className="font-display text-3xl font-medium tracking-tight">
            อยากได้เว็บแบบไหน<span className="text-shine">?</span>
          </h2>
          <p className="mt-2 max-w-xl text-center text-white/80">
            ไม่ใช่ wireframe ไม่ใช่ mockup — แต่เป็น web demo ที่คลิกได้ กรอกฟอร์มได้
            รันด้วยโค้ดจริงใน browser ของคุณ
          </p>
          <div className="mt-10 flex w-full justify-center">
            <LaunchPad />
          </div>
          <p className="mt-6 font-mono text-[12px] text-white/60">
            ไม่ต้องสมัครก่อนเริ่ม · รองรับไทย/อังกฤษ · โค้ดรันใน browser คุณ 100%
          </p>
        </section>

        {/* Preset marquee */}
        <section className="border-y border-night-edge py-4">
          <div className="overflow-hidden whitespace-nowrap">
            <div className="marquee-track inline-block">
              {[0, 1].map((copy) => (
                <span key={copy}>
                  {PRESETS.map((preset) => (
                    <span key={`${copy}-${preset.id}`} className="mx-6 font-display text-sm text-white/80">
                      <span className="mr-2 text-shine">✦</span>
                      {preset.name}
                      <span className="ml-2 font-mono text-[11px] text-white/40">
                        {preset.tagline}
                      </span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="font-display text-3xl font-medium tracking-tight">
            ทำงานยังไง<span className="text-shine">?</span>
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.no}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-shine/50"
              >
                <span className="font-mono text-sm font-semibold text-shine">{step.no}</span>
                <h3 className="mt-3 font-display text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/70">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Spec-to-Demo callout */}
        <section id="spec" className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-3xl border border-shine/30 bg-shine/5 p-8 md:p-10">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-shine">
                  Spec-to-Demo
                </p>
                <h2 className="mt-2 font-display text-2xl font-medium text-white">
                  มี BRD/PRD อยู่แล้ว? วางลงไปเลย
                </h2>
                <p className="mt-2 max-w-xl text-white/70">
                  ระบบอ่านเอกสาร เดา domain (ERP, CRM, E-commerce…) แล้วถามคำถามเจาะจง 3-5 ข้อ
                  ก่อนสร้าง demo ที่ตรง spec จริง ไม่ใช่ template กลางๆ
                </p>
              </div>
              <div className="flex max-w-xs flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <span
                    key={preset.id}
                    className="rounded-full border border-shine/40 px-3 py-1 font-mono text-[12px] text-shine"
                  >
                    {preset.nameEn}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 pb-24">
          <h2 className="font-display text-3xl font-medium tracking-tight">ราคา</h2>
          <p className="mt-2 text-white/70">
            เริ่มฟรี ไม่ต้องใส่บัตร — ระบบชำระเงินกำลังจะเปิดเร็วๆ นี้
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-6 ${
                  tier.hot
                    ? "border-shine bg-shine/[0.06]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {tier.hot && (
                  <span className="absolute -top-3 left-6 rounded-full bg-shine px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-black">
                    แนะนำ
                  </span>
                )}
                <h3 className="font-display text-lg font-semibold text-white">{tier.name}</h3>
                <p className="mt-2">
                  <span className="font-display text-4xl font-medium text-white">{tier.price}</span>
                  <span className="font-mono text-sm text-white/60">{tier.per}</span>
                </p>
                <ul className="mt-5 space-y-2 text-[15px] text-white/70">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 text-go">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <Logo />
          <span className="font-mono text-[12px] text-white/50">
            สร้าง demo แรกของคุณภายใน 60 วินาที — ฟรี
          </span>
        </div>
      </footer>
    </div>
  );
}
