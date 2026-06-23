"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

interface Step {
  no: string;
  title: string;
  body: string;
}

/**
 * Pinned scroll story for "ทำงานยังไง?": a tall section whose sticky viewport
 * cross-fades through the steps as the user scrolls — one card at a time.
 */
export default function ScrollStory({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <section id="how" ref={ref} className="relative" style={{ height: `${steps.length * 95}vh` }}>
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6">
        <h2 className="mb-10 font-display text-3xl font-medium tracking-tight text-white">
          ทำงานยังไง<span className="text-shine">?</span>
        </h2>
        <div className="relative h-[300px] w-full max-w-xl">
          {steps.map((step, i) => (
            <StoryCard key={step.no} progress={scrollYProgress} index={i} total={steps.length} step={step} />
          ))}
        </div>
        <ScrollHint progress={scrollYProgress} />
      </div>
    </section>
  );
}

function StoryCard({
  progress,
  index,
  total,
  step,
}: {
  progress: MotionValue<number>;
  index: number;
  total: number;
  step: Step;
}) {
  const seg = 1 / total;
  const start = index * seg;
  const opacity = useTransform(
    progress,
    [start - seg * 0.6, start - seg * 0.15, start + seg * 0.7, start + seg],
    [0, 1, 1, 0]
  );
  const y = useTransform(progress, [start - seg * 0.6, start - seg * 0.15], [60, 0]);
  const scale = useTransform(progress, [start - seg * 0.6, start - seg * 0.15], [0.9, 1]);

  return (
    <motion.div
      style={{ opacity, y, scale }}
      className="absolute inset-0 flex flex-col justify-center rounded-3xl border border-white/12 bg-white/[0.05] p-8 backdrop-blur-md"
    >
      <span className="font-mono text-sm font-semibold text-shine">{step.no}</span>
      <h3 className="mt-3 font-display text-2xl font-semibold text-white">{step.title}</h3>
      <p className="mt-3 text-base leading-relaxed text-white/75">{step.body}</p>
    </motion.div>
  );
}

/** Progress dots showing where the reader is in the story. */
function ScrollHint({ progress }: { progress: MotionValue<number> }) {
  const width = useTransform(progress, [0, 1], ["0%", "100%"]);
  return (
    <div className="mt-10 h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
      <motion.div style={{ width }} className="h-full bg-shine" />
    </div>
  );
}
