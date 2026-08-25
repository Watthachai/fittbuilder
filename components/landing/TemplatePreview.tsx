"use client";

/**
 * A miniature of what each template's finished page roughly looks like,
 * drawn in pure CSS — no screenshot to keep in sync, works for a template
 * that has never been generated yet, and animates just enough to convey the
 * one thing a still image cannot: that these looks MOVE.
 *
 * These are impressions, not renders. The caption under the card says so.
 */
export default function TemplatePreview({ id, large }: { id: string; large?: boolean }) {
  const box = `relative w-full overflow-hidden ${large ? "aspect-[21/9] rounded-xl" : "aspect-[16/9] rounded-lg"} border border-chalk/10`;

  if (id === "cinematic-scroll") {
    return (
      <div className={box} aria-hidden="true">
        {/* sky → dusk */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#7fb4d4] via-[#4f7f9d] to-[#101c1c]" />
        {/* MID layer — far ridge */}
        <div className="absolute -left-[10%] right-[-10%] bottom-[26%] h-[38%] rounded-[100%] bg-[#28454e] opacity-70 blur-[2px]" />
        {/* HERO layer — near arch */}
        <div className="absolute left-1/2 bottom-[-32%] h-[64%] w-[74%] -translate-x-1/2 rounded-[100%] border-t-[6px] border-[#0d1615] bg-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[24%] bg-[#0d1615]" />
        {/* hero word */}
        <p className="absolute inset-x-0 top-[16%] text-center font-serif tracking-[0.08em] text-[#fdf1e1] tpl-title-drift"
           style={{ fontSize: large ? "2.6rem" : "1.55rem" }}>
          MOSTAR
        </p>
        {/* sight cards gliding in */}
        <div className="absolute bottom-[9%] left-0 flex gap-[4%] tpl-cards-glide">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[34px] w-[76px] shrink-0 rounded-md bg-[#fdf1e1] p-1 shadow-md">
              <div className="h-[5px] w-[52%] rounded-sm bg-[#111411]/70" />
              <div className="mt-[10px] h-[7px] w-[80%] rounded-sm bg-[#111411]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "spotlight-hero") {
    return (
      <div className={`${box} bg-[#08090b]`} aria-hidden="true">
        {/* hidden layer texture, revealed only inside the drifting light */}
        <div
          className="absolute inset-0 tpl-spot-drift"
          style={{
            background:
              "radial-gradient(circle at var(--tpl-x,30%) 55%, rgba(232,180,120,0.9) 0, rgba(190,120,70,0.5) 18%, rgba(60,40,30,0.15) 32%, transparent 45%)",
          }}
        />
        {/* faint base-image suggestion */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#1a1d21] to-transparent" />
        {/* headline lines */}
        <div className="absolute inset-x-0 top-[22%] flex flex-col items-center gap-[8%]">
          <p className="font-serif italic text-[#f4ede2]" style={{ fontSize: large ? "1.9rem" : "1.1rem" }}>
            Layers hold
          </p>
          <div className="h-[8%] w-[34%] rounded-sm bg-[#f4ede2]/85" />
        </div>
        {/* nav pill */}
        <div className="absolute inset-x-[30%] top-[6%] h-[9%] rounded-full border border-white/25 bg-white/10" />
        {/* CTA */}
        <div className="absolute bottom-[10%] right-[7%] h-[11%] w-[22%] rounded-full bg-[#e8702a]" />
      </div>
    );
  }

  return <div className={`${box} bg-night`} aria-hidden="true" />;
}
