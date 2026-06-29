import type { CSSProperties } from "react";

interface DnaMarkProps {
  /** Pixel height of the mark (drives everything via em). */
  size?: number;
  /** Number of base-pair columns. */
  bars?: number;
  /** Draw the rung (base-pair line) between strands. */
  rungs?: boolean;
  /** Per-column hue cycle (the science look); else uses `color`/currentColor. */
  rainbow?: boolean;
  /** Strand color when not rainbow (CSS color). */
  color?: string;
  className?: string;
}

/**
 * Animated DNA double-helix mark — the Org DNA badge/panel signature. Pure CSS
 * (keyframes in globals.css): each column's two dots oscillate in antiphase and a
 * per-column negative delay makes the crossing travel, so the strand twists.
 * Decorative → aria-hidden; reduced-motion freezes it to a static helix snapshot.
 */
export default function DnaMark({
  size = 14,
  bars = 5,
  rungs = true,
  rainbow = false,
  color,
  className = "",
}: DnaMarkProps) {
  return (
    <span
      aria-hidden
      className={`dna-mark${rainbow ? " dna-mark--rainbow" : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          fontSize: `${size}px`,
          ...(color ? { color } : {}),
          "--dna-n": bars,
        } as CSSProperties
      }
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="dna-mark__col"
          style={
            {
              "--i": i,
              "--h": Math.round((i / Math.max(1, bars - 1)) * 300),
            } as CSSProperties
          }
        >
          {rungs && <span className="dna-mark__rung" />}
          <span className="dna-mark__dot" />
          <span className="dna-mark__dot dna-mark__dot--b" />
        </span>
      ))}
    </span>
  );
}
