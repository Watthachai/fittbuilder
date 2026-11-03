"use client";

import { FONT_SCALE_DEFAULT, FONT_SCALE_MAX, FONT_SCALE_MIN, stepFontScale, useFontScale } from "@/lib/useFontScale";

/**
 * A− · 100% · A+ for the app's text size. The percent resets to the default.
 * Shared by the floating theme pill and the account menu.
 */
export default function FontScaleControl({ className = "" }: { className?: string }) {
  const [scale, setScale] = useFontScale();
  const btn =
    "grid h-8 w-9 place-items-center rounded-full font-display text-chalk-dim transition hover:bg-chalk/10 hover:text-chalk disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className={`flex items-center justify-between gap-1 rounded-full border border-chalk/15 p-1 ${className}`}>
      <button
        onClick={() => setScale(stepFontScale(scale, -1))}
        disabled={scale <= FONT_SCALE_MIN}
        aria-label="ตัวอักษรเล็กลง"
        title="ตัวอักษรเล็กลง"
        className={`${btn} text-xs`}
      >
        A−
      </button>
      <button
        onClick={() => setScale(FONT_SCALE_DEFAULT)}
        aria-label={`ขนาดตัวอักษร ${scale}% — กดเพื่อกลับขนาดปกติ`}
        title="กดเพื่อกลับขนาดปกติ"
        className="min-w-14 rounded-full px-2 py-1 font-mono text-xs text-chalk transition hover:bg-chalk/10"
      >
        {scale}%
      </button>
      <button
        onClick={() => setScale(stepFontScale(scale, 1))}
        disabled={scale >= FONT_SCALE_MAX}
        aria-label="ตัวอักษรใหญ่ขึ้น"
        title="ตัวอักษรใหญ่ขึ้น"
        className={`${btn} text-base`}
      >
        A+
      </button>
    </div>
  );
}
