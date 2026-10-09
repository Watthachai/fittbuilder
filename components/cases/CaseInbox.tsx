"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { alertKey, alertMessage, freshAlerts, type CaseAlert } from "@/lib/cases";
import { caseInbox, useCaseChanges } from "@/lib/cases-client";
import { toast } from "@/lib/toast";

/**
 * The cases waiting on the signed-in person, for every page at once: the bell
 * reads the count from here, and this is where a new answer or a new case turns
 * into a toast — and, while the tab is in the background, a desktop
 * notification (when the person allowed them from the bell).
 *
 * Mounted once in the root layout, so it lives across client navigations and
 * an alert is shown once. On a fresh load what is already waiting only sets
 * the count; it is not announced again.
 */

interface Inbox {
  signedIn: boolean;
  alerts: CaseAlert[];
  /** Read again now — after opening a case, which marks it seen. */
  refresh: () => void;
}

const InboxContext = createContext<Inbox>({ signedIn: false, alerts: [], refresh: () => {} });

export const useCaseInbox = (): Inbox => useContext(InboxContext);

const caseHref = (a: CaseAlert) => `/cases?id=${a.id}`;

/** Already looking at this case: its thread updates live, no need to announce it. */
function viewing(a: CaseAlert): boolean {
  return location.pathname === "/cases" && new URLSearchParams(location.search).get("id") === a.id;
}

function announce(a: CaseAlert) {
  if (viewing(a)) return;
  const { title, body } = alertMessage(a);
  toast.info(title, { description: body, duration: 8000, action: { label: "เปิดดูเคส", href: caseHref(a) } });
  if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
    const n = new Notification(title, { body, tag: alertKey(a), icon: "/logo.png" });
    n.onclick = () => {
      window.focus();
      location.assign(caseHref(a));
      n.close();
    };
  }
}

export function CaseInboxProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [alerts, setAlerts] = useState<CaseAlert[]>([]);
  // null until the first read: what was already waiting is not news.
  const seen = useRef<Set<string> | null>(null);

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
  }, []);

  // Every page change: signing in lands on a new page, and leaving /cases follows reading cases there.
  const pathname = usePathname();
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    // Coming back to the tab may follow a case read elsewhere.
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useCaseChanges(refresh, signedIn);

  return <InboxContext.Provider value={{ signedIn, alerts, refresh }}>{children}</InboxContext.Provider>;
}
