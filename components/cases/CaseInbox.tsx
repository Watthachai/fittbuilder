"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { alertKey, alertMessage, freshAlerts, type CaseAlert } from "@/lib/cases";
import { caseInbox, useCaseChanges } from "@/lib/cases-client";
import { toast } from "@/lib/toast";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import { InboxContext } from "./inbox-context";
import CasesView from "./CasesView";

export { useCaseInbox } from "./inbox-context";

/**
 * The cases waiting on the signed-in person, for every page at once: the bell
 * reads the count from here, and this is where a new answer or a new case turns
 * into a toast — and, while the tab is in the background, a desktop
 * notification (when the person allowed them from the bell).
 *
 * It also owns the cases overlay: the full cases view opened over whatever page
 * the person is on, so reading and answering a case never takes them out of the
 * studio they are working in.
 *
 * Mounted once in the root layout, so it lives across client navigations and
 * an alert is shown once. On a fresh load what is already waiting only sets
 * the count; it is not announced again.
 */
export function CaseInboxProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [alerts, setAlerts] = useState<CaseAlert[]>([]);
  // The overlay: undefined = closed, null = the list, an id = that case.
  const [overlay, setOverlay] = useState<string | null | undefined>(undefined);
  // null until the first read: what was already waiting is not news.
  const seen = useRef<Set<string> | null>(null);
  const viewing = useRef<string | null>(null);

  const openCases = useCallback((caseId?: string) => setOverlay(caseId ?? null), []);
  const setViewing = useCallback((caseId: string | null) => {
    viewing.current = caseId;
  }, []);

  const announce = useCallback(
    (a: CaseAlert) => {
      // Its thread is on screen and updates live: no need to say it twice.
      if (viewing.current === a.id) return;
      const { title, body } = alertMessage(a);
      toast.info(title, { description: body, duration: 8000, action: { label: "เปิดดูเคส", run: () => openCases(a.id) } });
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        const n = new Notification(title, { body, tag: alertKey(a), icon: "/logo.png" });
        n.onclick = () => {
          window.focus();
          openCases(a.id);
          n.close();
        };
      }
    },
    [openCases]
  );

  const refresh = useCallback(() => {
    void caseInbox()
      .then((inbox) => {
        setSignedIn(inbox.signedIn);
        setAlerts(inbox.alerts);
        if (seen.current) freshAlerts(seen.current, inbox.alerts).forEach(announce);
        seen.current ??= new Set();
        for (const a of inbox.alerts) seen.current.add(alertKey(a));
      })
      .catch(() => {});
  }, [announce]);

  // Every page change: signing in lands on a new page, and leaving /cases follows reading cases there.
  // A link followed from inside the overlay (a case's project) leaves the overlay behind.
  const pathname = usePathname();
  useEffect(() => {
    setOverlay(undefined);
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    // Coming back to the tab may follow a case read elsewhere.
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useCaseChanges(refresh, signedIn);

  const close = () => {
    setOverlay(undefined);
    refresh();
  };

  return (
    <InboxContext.Provider value={{ signedIn, alerts, refresh, openCases, setViewing }}>
      {children}
      <Overlay open={overlay !== undefined} onClose={close} placement="center" blur>
        <GlassSurface strong className="relative flex h-[calc(100vh-2rem)] w-full max-w-7xl overflow-hidden rounded-xl">
          {/* key: opening another case from the bell starts from that case. */}
          <CasesView key={overlay ?? "list"} initialId={overlay ?? null} embedded />
          <button
            onClick={close}
            aria-label="ปิดหน้าเคส"
            title="ปิด แล้วกลับไปที่หน้าเดิม"
            className="absolute right-3 top-3 rounded-sm border border-night-edge bg-night/80 p-1.5 text-chalk-dim transition hover:text-chalk"
          >
            <X size={16} />
          </button>
        </GlassSurface>
      </Overlay>
    </InboxContext.Provider>
  );
}
