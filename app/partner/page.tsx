import Link from "next/link";
import { ArrowLeft, FileText, Palette, Timer, Users } from "lucide-react";
import Reveal from "@/components/landing/Reveal";
import PartnerForm from "@/components/landing/PartnerForm";

export const metadata = {
  title: "เป็น Partner กับ FITT Builder",
  description:
    "รับงานพัฒนาเว็บในนามบริษัทคุณ ใช้ FITT Builder ทำ demo และออกใบเสนอราคาด้วยโลโก้ของคุณเอง",
};

/**
 * The partner pitch.
 *
 * Written for one reader: a small Thai software house or freelance team that
 * already has customers and already writes quotations by hand. Everything here
 * is something they do this week — the demo they cannot afford to build for
 * free, the quotation that takes an evening, the logo that has to be theirs.
 * No platform language, no "ecosystem".
 */

const VALUE = [
  {
    icon: Palette,
    title: "ใบเสนอราคาในนามบริษัทคุณ",
    body: "โลโก้ ชื่อนิติบุคคล เลขผู้เสียภาษี ที่อยู่ — เป็นของคุณทั้งใบ ไม่มีชื่อเราอยู่บนกระดาษที่ลูกค้าคุณเซ็น",
  },
  {
    icon: Timer,
    title: "จาก brief เป็น demo ที่รันได้ ในหลักนาที",
    body: "พิมพ์สิ่งที่ลูกค้าอยากได้เป็นภาษาไทย ได้เว็บที่กดใช้ได้จริงไปนำเสนอ ไม่ต้องลงแรงสร้างของฟรีก่อนปิดงาน",
  },
  {
    icon: FileText,
    title: "ใบเสนอราคาที่คิดเงินตามหน้าจอจริง",
    body: "ระบบเดินดูทุกหน้าและทุก modal ในเดโม แล้วตั้งเป็นรายการราคาให้ พร้อมงวดชำระ เงื่อนไขตรวจรับ และค่า MA",
  },
  {
    icon: Users,
    title: "ทีมคุณทำงานร่วมกันได้",
    body: "workspace เดียว แชร์โปรเจกต์ให้ทีมและให้ลูกค้าดูได้ พร้อม Org DNA ที่ทำให้ AI เขียนงานในสไตล์บริษัทคุณ",
  },
];

const STEPS = [
  {
    title: "คุยกันก่อน",
    body: "ส่งฟอร์มมา เราโทรกลับภายใน 2 วันทำการ คุยว่าคุณรับงานแบบไหน ลูกค้าเป็นใคร และเงื่อนไขแบบไหนที่คุ้มกับทั้งสองฝ่าย",
  },
  {
    title: "เปิด workspace ให้",
    body: "ตั้งค่าสถานะ Partner ให้ workspace ของคุณ แล้วคุณอัปโหลดโลโก้และกรอกข้อมูลบริษัทเองได้เลย",
  },
  {
    title: "รับงานได้เลย",
    body: "ทำ demo ให้ลูกค้าคุณ ออกใบเสนอราคาในนามบริษัทคุณ เราอยู่ข้างหลังในฐานะเครื่องมือ ไม่ใช่คู่แข่ง",
  },
];

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-night text-chalk">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[13px] text-chalk/60 transition hover:text-chalk"
        >
          <ArrowLeft size={14} /> FITT Builder
        </Link>
        <a
          href="#apply"
          className="rounded-full bg-shine px-4 py-1.5 font-display text-[13px] font-semibold text-night transition hover:brightness-110"
        >
          สมัครเป็น Partner
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-10 pb-16 sm:pt-16">
          <Reveal>
            <p className="font-mono text-[13px] uppercase tracking-[0.2em] text-shine">
              Partner Program
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.15] font-medium tracking-tight text-chalk sm:text-6xl">
              รับงานในนามบริษัทคุณ
              <span className="block text-chalk/45">เราเป็นแค่เครื่องมือที่อยู่ข้างหลัง</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-chalk/70">
              ถ้าคุณรับงานพัฒนาเว็บอยู่แล้ว สิ่งที่กินเวลาที่สุดคือสองอย่าง — ทำ demo ให้ลูกค้าดูก่อนปิดงาน
              และนั่งทำใบเสนอราคาทีละบรรทัด FITT Builder ทำทั้งสองอย่างให้ในนามบริษัทคุณ
              พร้อมโลโก้ของคุณบนเอกสารทุกใบ
            </p>
          </Reveal>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {VALUE.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06}>
              <div className="h-full rounded-3xl border border-chalk/12 bg-chalk/[0.05] p-6 backdrop-blur-xl">
                <v.icon size={20} className="text-shine" />
                <h2 className="mt-3 font-display text-lg font-semibold text-chalk">{v.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-chalk/65">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </section>

        {/* Numbered because these genuinely happen in order — you cannot brand a
            workspace before we have opened one for you. */}
        <section className="mt-20">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight">เริ่มยังไง</h2>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="h-full rounded-3xl border border-chalk/12 bg-chalk/[0.05] p-6 backdrop-blur-xl">
                  <span className="font-mono text-[13px] text-shine">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-display text-lg font-semibold text-chalk">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-chalk/65">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="apply" className="mt-20 scroll-mt-8">
          <Reveal>
            <h2 className="font-display text-3xl font-medium tracking-tight">สมัครเป็น Partner</h2>
            <p className="mt-2 max-w-2xl text-chalk/65">
              กรอกสั้นๆ พอให้เราโทรกลับถูกคน — รายละเอียดที่เหลือคุยกันตอนคุย
            </p>
          </Reveal>
          <div className="mt-8 max-w-2xl">
            <Reveal>
              <PartnerForm />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-chalk/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 font-mono text-[12px] text-chalk/45 sm:flex-row">
          <Link href="/" className="transition hover:text-chalk">
            ← กลับหน้าแรก
          </Link>
          <span>สร้าง demo แรกของคุณภายใน 60 วินาที — ฟรี</span>
        </div>
      </footer>
    </div>
  );
}
