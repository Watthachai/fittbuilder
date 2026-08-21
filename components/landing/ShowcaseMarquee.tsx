"use client";

import { useEffect, useRef, useState } from "react";

export interface ShowcaseTile {
  /** Path under /public — a webp crop of the demo's first screen. */
  src: string;
  /** The system it came from, and which screen — read out by screen readers. */
  system: string;
  screen: string;
}

/**
 * Two rows of real demo screens that slide past each other as the page scrolls.
 *
 * The tiles are not illustrations: every one is a crop of a screen this builder
 * actually produced, captured from the running demo by the screen inventory
 * (`lib/shots.ts`). That is the entire argument of the section — a landing page
 * for a builder either shows what it builds or asks to be taken on faith.
 *
 * Movement is tied to scroll position rather than a CSS animation loop, so the
 * rows only travel while the reader is travelling. A looping marquee reads as
 * decoration; one that answers the scroll reads as a response.
 *
 * The list is DOUBLED and parked a third of the way in: the rows drift in
 * opposite directions and a single copy would run out of tiles at one edge.
 * Travel over the section's scroll span is roughly (viewport + section) × 0.3
 * ≈ 500px, against a copy several times wider than any viewport — so the seam
 * is never reached and no modulo bookkeeping is needed. This assumes a list
 * long enough to overfill a screen; a handful of tiles would want more copies.
 */
export default function ShowcaseMarquee({ tiles }: { tiles: ShowcaseTile[] }) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // Someone who asked for less motion gets the rows where they started.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setOffset((window.scrollY - top + window.innerHeight) * 0.3);
    };
    const onScroll = () => {
      // One measurement per frame — scroll fires far more often than paint.
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const half = Math.ceil(tiles.length / 2);
  const rows = [tiles.slice(0, half), tiles.slice(half)];
  const travel = offset - 200;

  return (
    <section
      ref={ref}
      aria-label="ตัวอย่างระบบที่สร้างจาก FITT Builder"
      className="overflow-hidden border-y border-chalk/10 py-14 sm:py-20"
    >
      <p className="mb-8 px-6 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-chalk/45 sm:text-[12px]">
        ทุกภาพคือหน้าจอจริงที่ระบบนี้สร้าง
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((row, r) => (
          <div key={r} className="flex overflow-hidden">
            <div
              className="flex shrink-0 gap-3"
              style={{
                // Row 0 drifts right, row 1 left — the counter-motion is what
                // makes the band read as depth instead of a conveyor belt.
                transform: `translate3d(calc(-33.333% + ${r === 0 ? travel : -travel}px), 0, 0)`,
                willChange: "transform",
              }}
            >
              {[0, 1].map((copy) =>
                row.map((tile) => (
                  <figure
                    key={`${copy}-${tile.src}`}
                    className="relative h-[180px] w-[280px] shrink-0 overflow-hidden rounded-2xl border border-chalk/12 bg-night-panel sm:h-[219px] sm:w-[340px] md:h-[270px] md:w-[420px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tile.src}
                      // Only the first copy is announced; the other two are the
                      // same pictures again and would triple the reading.
                      alt={copy === 0 ? `${tile.system} — ${tile.screen}` : ""}
                      aria-hidden={copy !== 0}
                      width={840}
                      height={540}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-top"
                    />
                  </figure>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
