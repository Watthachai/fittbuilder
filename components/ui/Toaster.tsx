"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { dismiss, subscribeToasts, type Toast, type ToastType } from "@/lib/toast";

const ICON: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const ACCENT: Record<ToastType, string> = {
  success: "text-go",
  error: "text-halt",
  warning: "text-amber-400",
  info: "text-shine",
  loading: "text-shine",
};

/**
 * Renders the app-wide toast stack (top-right). Subscribes to the toast store and
 * mirrors it; exit is driven by the store's `leaving` flag + a CSS animation.
 */
export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
      {items.map((t) => {
        const Icon = ICON[t.type];
        return (
          <div
            key={t.id}
            data-leaving={t.leaving ? "true" : undefined}
            role="status"
            aria-live={t.type === "error" ? "assertive" : "polite"}
            className="toast-item glass pointer-events-auto flex items-start gap-3 rounded-xl border border-night-edge px-3.5 py-3 shadow-2xl"
          >
            <Icon
              size={18}
              className={`mt-0.5 shrink-0 ${ACCENT[t.type]} ${t.type === "loading" ? "animate-spin" : ""}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-chalk">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 break-words text-[12px] leading-relaxed text-chalk-dim">
                  {t.description}
                </p>
              )}
            </div>
            {t.type !== "loading" && (
              <button
                onClick={() => dismiss(t.id)}
                className="-mr-1 -mt-0.5 shrink-0 rounded-sm p-1 text-chalk-dim transition hover:text-chalk"
                title="ปิด"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
