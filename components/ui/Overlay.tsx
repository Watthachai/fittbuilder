"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "@/lib/useDismiss";

type Placement = "center" | "top-end" | "none";

const PLACEMENT: Record<Placement, string> = {
  center: "flex items-center justify-center p-4",
  "top-end": "flex items-start justify-end p-3",
  none: "",
};

/**
 * The canonical viewport-level overlay.
 *
 * - Portals to <body> so an ancestor with backdrop-filter/transform can't become
 *   the containing block (which would make `fixed inset-0` cover only the
 *   ancestor and clip it).
 * - Scrim colours come from the `--overlay-dim` token (theme-aware); set `blur`
 *   for a frosted backdrop (`.glass-scrim`). The scrim animates opacity only —
 *   never a transform — so its blur always renders.
 * - Dismiss on click-outside (clicking the scrim, not the panel) and Escape.
 *
 * Children are the panel — render a <GlassSurface> (or any transform-free panel)
 * inside; clicks on the panel do not dismiss.
 */
export default function Overlay({
  open,
  onClose,
  dim = true,
  blur = false,
  placement = "center",
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  dim?: boolean;
  blur?: boolean;
  placement?: Placement;
  className?: string;
  children: ReactNode;
}) {
  useDismiss(open, onClose);
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          // Close only when the scrim itself is clicked, not a bubbled panel click.
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className={`fixed inset-0 z-50 ${PLACEMENT[placement]} ${blur ? "glass-scrim" : ""} ${className}`}
          style={dim ? { background: "var(--overlay-dim)" } : undefined}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
