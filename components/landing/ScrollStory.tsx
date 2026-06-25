"use client";

import { useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";

interface Step {
  no: string;
  title: string;
  body: string;
}

/**
 * Pinned scroll story for "ทำงานยังไง?": a tall section whose sticky viewport
 * cross-fades through the steps as the user scrolls — one card at a time.
 *
 * Drives the active step from the scroll progress (via useMotionValueEvent) and
 * tweens the cards with CSS transitions — avoids per-card useTransform, which
 * tripped the WAAPI "offsets must be monotonically non-decreasing" error.
 */
export default function ScrollStory({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length)));
    setActive(idx);
    setProgress(Math.min(100, Math.max(0, Math.round(v * 100))));
  });

  return (
    <section id="how" ref={ref} className="relative" style={{ height: `${steps.length * 95}vh` }}>
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6">
        <h2 className="mb-10 font-display text-3xl font-medium tracking-tight text-chalk">
          ทำงานยังไง<span className="text-shine">?</span>
        </h2>
        <div className="relative h-[300px] w-full max-w-xl">
          {steps.map((step, i) => (
            <div
              key={step.no}
              className="absolute inset-0 transition-all duration-500 ease-out"
              style={{
                opacity: i === active ? 1 : 0,
                transform: i === active ? "translateY(0) scale(1)" : "translateY(40px) scale(0.94)",
                pointerEvents: i === active ? "auto" : "none",
              }}
            >
              <div className="flex h-full flex-col justify-center rounded-3xl border border-chalk/12 bg-chalk/[0.05] p-8 shadow-glass backdrop-blur-md">
                <span className="font-mono text-sm font-semibold text-shine">{step.no}</span>
                <h3 className="mt-3 font-display text-2xl font-semibold text-chalk">{step.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-chalk/75">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 h-[3px] w-40 overflow-hidden rounded-full bg-chalk/10">
          <div
            className="h-full bg-shine transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
