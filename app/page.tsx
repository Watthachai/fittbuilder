import Link from "next/link";
import MainframeHero from "@/components/landing/MainframeHero";
import ScrollStory from "@/components/landing/ScrollStory";
import SpecJourney from "@/components/landing/SpecJourney";
import ShowcaseMarquee from "@/components/landing/ShowcaseMarquee";
import PartnerStack from "@/components/landing/PartnerStack";
import { SHOWCASE } from "@/lib/showcase";

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


function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
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
        {/* Real demo screens, drifting against the scroll */}
        <ShowcaseMarquee tiles={SHOWCASE} />

        {/* How it works — pinned scroll story */}
        <ScrollStory steps={STEPS} />

        {/* Spec-to-Demo — pinned scroll journey (type → detect → Define → … → Ship) */}
        <SpecJourney />

        <PartnerStack />
      </main>

      <footer className="relative z-10 border-t border-chalk/10 bg-night/70 py-8 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <Logo />
          <div className="flex items-center gap-5 font-mono text-[12px] text-chalk/50">
            <Link href="/partner" className="transition hover:text-shine">
              เป็น Partner กับเรา
            </Link>
            <span>สร้าง demo แรกของคุณภายใน 60 วินาที — ฟรี</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
