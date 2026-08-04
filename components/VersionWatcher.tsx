"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { latestVersion } from "@/lib/changelog";

/**
 * Tells an open tab that the server moved on.
 *
 * A deploy swaps the server, but a tab keeps the bundle it already loaded —
 * and in the studio that bundle also owns a running WebContainer whose bridge
 * scripts were written at boot. So a teammate's "อัปเดตแล้ว" and your refresh
 * changing nothing are both true, and people learn to hard-reload by folklore.
 *
 * The version compiled into this bundle is compared against the server's on
 * mount, whenever the tab regains focus, and every ten minutes. A reload here
 * is deliberately the full kind: it re-fetches the document and reboots the
 * container, which is what actually picks up new bridge scripts.
 */
const CHECK_EVERY_MS = 10 * 60_000;

export default function VersionWatcher() {
  const mine = latestVersion();
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  // Read once at construction rather than in an effect: nothing renders until
  // the server's version arrives, so there is no hydration mismatch to cause.
  const [dismissed, setDismissed] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem("fitt-version-dismissed");
    } catch {
      return null; // private mode — the bar just asks again next time
    }
  });

  const check = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    fetch("/api/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { version?: string } | null) => {
        if (d?.version) setServerVersion(d.version);
      })
      .catch(() => {
        /* offline or mid-deploy — the next check settles it */
      });
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [check]);

  const stale = Boolean(serverVersion && serverVersion !== mine && serverVersion !== dismissed);
  if (!stale) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4">
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-full py-2 pl-4 pr-2 shadow-glass">
        <span className="text-[13px] text-chalk">
          มีเวอร์ชันใหม่ <span className="font-mono text-shine">{serverVersion}</span>{" "}
          <span className="text-chalk-dim">(คุณอยู่ที่ {mine})</span>
        </span>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-shine px-3 py-1 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
        >
          <RefreshCw size={12} /> โหลดใหม่
        </button>
        <button
          onClick={() => {
            if (serverVersion) {
              setDismissed(serverVersion);
              try {
                sessionStorage.setItem("fitt-version-dismissed", serverVersion);
              } catch {
                /* nothing to remember it with — it will ask again */
              }
            }
          }}
          aria-label="ไว้ทีหลัง"
          className="shrink-0 rounded-full p-1.5 text-chalk-dim transition hover:text-chalk"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
