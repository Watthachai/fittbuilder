"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";

/**
 * The single approved way to render a frosted-glass panel.
 *
 * INVARIANT: a glass element must NEVER carry a CSS transform — `transform` +
 * `backdrop-filter` on the same element makes the blur render nothing
 * (Chrome/WebKit). For entrance/hover animation, wrap this in a separate motion
 * wrapper and animate opacity there; keep this surface transform-free.
 */
export default function GlassSurface({
  strong = false,
  className = "",
  children,
  onClick,
  style,
}: {
  strong?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`${strong ? "glass-strong" : "glass"} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
