"use client";

import { useSyncExternalStore } from "react";

/**
 * How big the app's text is, as a percent of the browser's own size. Every UI
 * size is in rem, so the root font-size moves all of it; documents (.fitt-paper),
 * the code editor and the demo preview keep their own sizes. Kept per device,
 * like the theme — the no-FOUC bootstrap in app/layout.tsx applies it before
 * paint with the same key.
 */
export const FONT_SCALE_KEY = "fitt-font-scale";
export const FONT_SCALE_MIN = 90;
export const FONT_SCALE_MAX = 140;
export const FONT_SCALE_STEP = 10;
export const FONT_SCALE_DEFAULT = 100;

const FONT_SCALE_EVENT = "fitt-font-scale-change";

/** A stored value as a step on the scale, or the default when it is not one. */
export function parseFontScale(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < FONT_SCALE_MIN || n > FONT_SCALE_MAX || n % FONT_SCALE_STEP !== 0) {
    return FONT_SCALE_DEFAULT;
  }
  return n;
}

/** One step up or down, held inside the scale. */
export function stepFontScale(scale: number, direction: 1 | -1): number {
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, scale + direction * FONT_SCALE_STEP));
}

function applyFontScale(scale: number) {
  document.documentElement.style.fontSize = scale === FONT_SCALE_DEFAULT ? "" : `${scale}%`;
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(FONT_SCALE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(FONT_SCALE_EVENT, cb);
  };
}
function getSnapshot(): number {
  try {
    return parseFontScale(localStorage.getItem(FONT_SCALE_KEY));
  } catch {
    return FONT_SCALE_DEFAULT;
  }
}
const getServerSnapshot = () => FONT_SCALE_DEFAULT;

/** The text size and its setter, in step across every mount (the floating pill, the account menu). */
export function useFontScale(): [number, (scale: number) => void] {
  const scale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setScale = (next: number) => {
    const value = parseFontScale(String(next));
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(value));
    } catch {
      /* private mode — non-fatal */
    }
    applyFontScale(value);
    window.dispatchEvent(new Event(FONT_SCALE_EVENT));
  };
  return [scale, setScale];
}
