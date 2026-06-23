import Link from "next/link";
import MainframeHero from "@/components/landing/MainframeHero";
import Reveal from "@/components/landing/Reveal";
import { PRESETS } from "@/lib/presets";

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
      {/* Full-screen Mainframe-style hero with the embedded builder */}
      <MainframeHero />

      {/* Below-fold marketing — opaque layer that scrolls over the fixed hero video */}
      <main className="relative z-10 bg-black">
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
                      <span className="ml-2 font-mono text-[11px] text-white/40">{preset.tagline}</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-7xl px-6 py-20">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight">
              ทำงานยังไง<span className="text-shine">?</span>
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.no} delay={i * 0.08}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-shine/50">
                  <span className="font-mono text-sm font-semibold text-shine">{step.no}</span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/70">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Spec-to-Demo callout */}
        <section id="spec" className="mx-auto max-w-7xl px-6 pb-20">
          <Reveal>
            <div className="rounded-3xl border border-shine/30 bg-shine/5 p-8 md:p-10">
              <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-shine">Spec-to-Demo</p>
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
          </Reveal>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 pb-24">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight">ราคา</h2>
            <p className="mt-2 text-white/70">เริ่มฟรี ไม่ต้องใส่บัตร — ระบบชำระเงินกำลังจะเปิดเร็วๆ นี้</p>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 0.08}>
                <div
                  className={`relative rounded-2xl border p-6 ${
                    tier.hot ? "border-shine bg-shine/[0.06]" : "border-white/10 bg-white/[0.03]"
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
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black py-8">
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
