import Link from "next/link";
import MainframeHero from "@/components/landing/MainframeHero";
import Reveal from "@/components/landing/Reveal";
import ScrollStory from "@/components/landing/ScrollStory";
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
      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-chalk">
        <span className="h-2.5 w-2.5 rounded-full bg-chalk" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight text-chalk">
        FITT Builder
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-night text-chalk">
      {/* Full-screen Mainframe-style hero with the embedded builder */}
      <MainframeHero />

      {/* Below-fold marketing — glass layer: the fixed hero video shows through, blurred */}
      <main className="relative z-10 bg-night/70 backdrop-blur-2xl">
        {/* Preset marquee */}
        <section className="border-y border-chalk/10 py-4">
          <div className="overflow-hidden whitespace-nowrap">
            <div className="marquee-track inline-block">
              {[0, 1].map((copy) => (
                <span key={copy}>
                  {PRESETS.map((preset) => (
                    <span
                      key={`${copy}-${preset.id}`}
                      className="mx-2 inline-flex items-center gap-2 rounded-full border border-chalk/12 bg-chalk/[0.05] px-4 py-1.5 backdrop-blur-sm"
                    >
                      <span className="text-shine">✦</span>
                      <span className="font-display text-sm text-chalk/85">{preset.name}</span>
                      <span className="font-mono text-[11px] text-chalk/40">{preset.tagline}</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — pinned scroll story */}
        <ScrollStory steps={STEPS} />

        {/* Spec-to-Demo callout */}
        <section id="spec" className="mx-auto max-w-7xl px-6 pb-20">
          <Reveal>
            <div className="rounded-3xl border border-chalk/12 bg-chalk/[0.05] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-10">
              <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-shine">Spec-to-Demo</p>
                  <h2 className="mt-2 font-display text-2xl font-medium text-chalk">
                    มี BRD/PRD อยู่แล้ว? วางลงไปเลย
                  </h2>
                  <p className="mt-2 max-w-xl text-chalk/70">
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
            <p className="mt-2 text-chalk/70">เริ่มฟรี ไม่ต้องใส่บัตร — ระบบชำระเงินกำลังจะเปิดเร็วๆ นี้</p>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 0.08}>
                <div
                  className={`relative rounded-3xl border p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:-translate-y-1 ${
                    tier.hot ? "border-shine/60 bg-shine/[0.08]" : "border-chalk/12 bg-chalk/[0.06]"
                  }`}
                >
                  {tier.hot && (
                    <span className="absolute -top-3 left-6 rounded-full bg-shine px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-night">
                      แนะนำ
                    </span>
                  )}
                  <h3 className="font-display text-lg font-semibold text-chalk">{tier.name}</h3>
                  <p className="mt-2">
                    <span className="font-display text-4xl font-medium text-chalk">{tier.price}</span>
                    <span className="font-mono text-sm text-chalk/60">{tier.per}</span>
                  </p>
                  <ul className="mt-5 space-y-2 text-[15px] text-chalk/70">
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

      <footer className="relative z-10 border-t border-chalk/10 bg-night/70 py-8 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <Logo />
          <span className="font-mono text-[12px] text-chalk/50">
            สร้าง demo แรกของคุณภายใน 60 วินาที — ฟรี
          </span>
        </div>
      </footer>
    </div>
  );
}
