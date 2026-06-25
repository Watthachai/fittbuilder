"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

/**
 * Full-screen image viewer. Portals to <body> so it escapes any clipped/
 * transformed ancestor (e.g. the chat dropdown). Click the backdrop or press Esc
 * to close; the image itself doesn't close on click.
 */
export default function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <a
          href={src}
          download={alt || "image"}
          onClick={(e) => e.stopPropagation()}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          title="ดาวน์โหลด"
        >
          <Download size={16} />
        </a>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          title="ปิด (Esc)"
        >
          <X size={18} />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
      {alt && (
        <p className="absolute bottom-5 left-1/2 max-w-[80vw] -translate-x-1/2 truncate rounded-full bg-black/60 px-3 py-1 font-mono text-[12px] text-white/80">
          {alt}
        </p>
      )}
    </div>,
    document.body
  );
}
