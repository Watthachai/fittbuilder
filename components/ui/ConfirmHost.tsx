"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { subscribeDialog, settleDialog, type Dialog } from "@/lib/confirm";

/** Renders the active confirm/prompt dialog from the confirm store. */
export default function ConfirmHost() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [value, setValue] = useState("");
  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => subscribeDialog(setDialog), []);

  // Seed the prompt input when a new dialog opens (render-time, not an effect).
  if (dialog?.kind === "prompt" && seededFor !== dialog.id) {
    setSeededFor(dialog.id);
    setValue(dialog.defaultValue ?? "");
  }

  const cancel = () => {
    if (dialog) settleDialog(dialog.kind === "prompt" ? null : false);
  };
  const accept = () => {
    if (dialog) settleDialog(dialog.kind === "prompt" ? value.trim() || null : true);
  };

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Enter" && dialog.kind === "confirm") accept();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (typeof document === "undefined" || !dialog) return null;

  const danger = "danger" in dialog && dialog.danger;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div className="glass-strong w-[min(92vw,26rem)] rounded-2xl border border-night-edge p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          {danger && (
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-halt/15 text-halt">
              <AlertTriangle size={17} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-chalk">{dialog.title}</h2>
            {dialog.message && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">{dialog.message}</p>
            )}
          </div>
        </div>

        {dialog.kind === "prompt" && (
          <div className="mt-4">
            {dialog.label && (
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
                {dialog.label}
              </label>
            )}
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") accept();
              }}
              placeholder={dialog.placeholder}
              className="w-full rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[14px] text-chalk outline-none focus:border-shine"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={cancel}
            className="rounded-lg border border-night-edge px-4 py-2 font-display text-sm text-chalk-dim transition hover:text-chalk"
          >
            {dialog.cancelLabel ?? "ยกเลิก"}
          </button>
          <button
            onClick={accept}
            disabled={dialog.kind === "prompt" && !value.trim()}
            className={`rounded-lg px-4 py-2 font-display text-sm font-semibold transition disabled:opacity-40 ${
              danger
                ? "bg-halt text-white hover:brightness-110"
                : "bg-shine text-night hover:brightness-110"
            }`}
          >
            {dialog.confirmLabel ?? "ยืนยัน"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
