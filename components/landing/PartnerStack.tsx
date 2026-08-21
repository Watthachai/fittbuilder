"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { ArrowRight, FileText, Palette, Timer } from "lucide-react";
import PartnerLetterhead from "./PartnerLetterhead";

const CARDS = [
  {
    icon: Palette,
    title: "ใบเสนอราคาในนามบริษัทคุณ",
    body: "โลโก้ ชื่อนิติบุคคล เลขผู้เสียภาษี ที่อยู่ — เป็นของคุณทั้งใบ ไม่มีชื่อเราอยู่บนกระดาษที่ลูกค้าคุณเซ็น",
  },
  {
    icon: Timer,
    title: "จาก brief เป็นระบบที่รันได้ ในหลักนาที",
    body: "พิมพ์สิ่งที่ลูกค้าอยากได้เป็นภาษาไทย ได้เว็บที่กดใช้ได้จริงไปนำเสนอ ไม่ต้องลงแรงสร้างของฟรีก่อนปิดงาน",
  },
  {
    icon: FileText,
    title: "คิดเงินตามหน้าจอจริง",
    body: "ระบบเดินดูทุกหน้าและทุก modal ในเว็บ แล้วตั้งเป็นรายการราคาให้ พร้อมงวดชำระ เงื่อนไขตรวจรับ และค่า MA",
  },
];

/**
 * The partner pitch as a deck that stacks up as you scroll.
 *
 * Each card pins a little lower than the one before, so a card that has had its
 * turn stays on screen as a shrinking edge under the next — the three points get
 * read one at a time instead of scanned as a row, for the same reason the "how
 * it works" story is pinned rather than laid out flat.
 *
 * All three cards are DIRECT children of one container, which is what makes them
 * pile up. The obvious construction — each card sticky inside its own tall
 * spacer — does not stack: a sticky element is released once its own parent's
 * bottom passes it, so card 1 slid away long before card 2 arrived and the
 * screen sat empty in between. Sharing a parent, each card stays pinned until
 * the whole deck is done, and the gap between arrivals comes from the card
 * heights and the margin below them.
 *
 * The pin offset (68px) is not a taste call: it is the height of a card's own
 * number-and-heading row. Anything smaller and the next card rides up THROUGH
 * the heading of the one below — a deck of half-sliced titles — because a card
 * still flowing toward its pin passes over whatever sits in that strip. At 68px
 * the strip always shows a whole heading, so the stack reads as an index of
 * what you have already been told.
 *
 * The card background is OPAQUE on purpose. A translucent panel let the two
 * cards underneath bleed their headings through the top one and all three
 * paragraphs overlapped into noise — a deck only reads as a deck if the card on
 * top actually covers what is under it.
 *
 * Scale comes from ONE scroll value with CSS interpolating, not a useTransform
 * per card: that tripped WAAPI's "offsets must be monotonically non-decreasing"
 * (see ScrollStory).
 */
export default function PartnerStack() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [progress, setProgress] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", setProgress);

  return (
    <section id="partner" className="mx-auto max-w-4xl px-6 pt-20 pb-24 sm:pt-28">
      <h2 className="landing-display text-center">Partner</h2>
      <p className="mx-auto mt-5 max-w-xl text-center text-[17px] leading-relaxed text-chalk/65">
        รับงานพัฒนาเว็บในนามบริษัทคุณ — เราเป็นแค่เครื่องมือที่อยู่ข้างหลัง
      </p>

      <div ref={ref} className="mt-16">
        {CARDS.map((card, i) => {
          // How far this card has been scrolled past, 0 → 1. The last card never
          // reaches 1, which is right: nothing comes up over it.
          const passed = Math.min(1, Math.max(0, progress * CARDS.length - i));
          return (
            <div
              key={card.title}
              className="sticky mb-8"
              style={{ top: `calc(5.5rem + ${i * 68}px)` }}
            >
              <article
                className="relative flex min-h-[10rem] items-start gap-5 overflow-hidden rounded-[28px] border border-chalk/12 bg-night-panel px-7 pt-6 pb-8 shadow-[0_-2px_40px_rgba(0,0,0,0.35)] sm:gap-8 sm:rounded-[36px] sm:px-10 sm:pt-7 sm:pb-10"
                style={{
                  transform: `scale(${1 - passed * 0.06})`,
                  // Shrink DOWNWARD from the pinned edge, so the strip each card
                  // leaves above the next keeps a fixed height.
                  transformOrigin: "top",
                  willChange: "transform",
                }}
              >
                {/* The number is a place in the deck, not a headline — 12% so it
                    sits behind the words rather than competing with them. */}
                <span
                  aria-hidden
                  className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-none font-bold tracking-tighter text-chalk/15"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <card.icon
                  size={22}
                  className="absolute top-6 right-7 text-shine sm:top-7 sm:right-10"
                  aria-hidden
                />
                <div className="flex-1 pr-8">
                  <h3 className="font-display text-xl leading-tight font-medium tracking-tight text-chalk sm:text-[1.75rem]">
                    {card.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-chalk/65 sm:text-[17px]">
                    {card.body}
                  </p>
                </div>
              </article>
            </div>
          );
        })}
      </div>

      {/* The deck ends on the artifact, not on another sentence. */}
      <PartnerLetterhead />

      <div className="mt-14 flex justify-center">
        <Link
          href="/partner"
          className="inline-flex items-center gap-2.5 rounded-full bg-shine px-8 py-3.5 font-display text-[15px] font-semibold text-night transition hover:-translate-y-0.5 hover:brightness-110"
        >
          ดูรายละเอียด Partner
          <ArrowRight size={17} strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
