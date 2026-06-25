"use client";

import { useEffect } from "react";

/**
 * While `active`, dismiss on the Escape key. One implementation shared by every
 * overlay (modals, drawers, popovers) so the behaviour can't drift. Click-outside
 * stays declarative via the <Overlay> scrim so anchored popovers can opt out.
 */
export function useDismiss(active: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onDismiss]);
}
