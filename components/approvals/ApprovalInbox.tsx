"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCaseInbox } from "@/components/cases/inbox-context";
import type { ApprovalAlert } from "@/lib/approval-notice";
import { loadApprovalAlerts } from "@/lib/doc-approval-store";
import { toast } from "@/lib/toast";

/** Often enough that a document on someone's desk shows without a reload, on a query small enough not to matter. */
const POLL_MS = 60_000;

export const ApprovalInboxContext = createContext<{ waiting: number; changes: number; refresh: () => void }>({
  waiting: 0,
  changes: 0,
  refresh: () => {},
});

export const useApprovalInbox = () => useContext(ApprovalInboxContext);

/**
 * Documents waiting on the signed-in person and moves on their own requests, for
 * every page at once. The bell and the menu read the count from here; a new one
 * turns into a toast and, while the tab is in the background, a desktop
 * notification (when allowed from the bell). On a fresh load what is already
 * there only sets the count: it is not announced again.
 */
export function ApprovalInboxProvider({ children }: { children: ReactNode }) {
  const { signedIn } = useCaseInbox();
  const router = useRouter();
  const pathname = usePathname();
  const [waiting, setWaiting] = useState(0);
  const [changes, setChanges] = useState(0);
  // null until the first read: what was already there is not news.
  const seen = useRef<Set<string> | null>(null);

  const announce = useCallback(
    (a: ApprovalAlert) => {
      toast.info(a.title, {
        description: a.body,
        duration: 8000,
        action: { label: "เปิดดู", run: () => router.push(a.href) },
      });
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        const n = new Notification(a.title, { body: a.body, tag: a.key, icon: "/logo.png" });
        n.onclick = () => {
          window.focus();
          router.push(a.href);
          n.close();
        };
      }
    },
    [router]
  );

  const refresh = useCallback(() => {
    void loadApprovalAlerts()
      .then((alerts) => {
        setWaiting(alerts.filter((a) => a.waiting).length);
        if (seen.current) {
          const fresh = alerts.filter((a) => !seen.current?.has(a.key));
          fresh.forEach(announce);
          if (fresh.length) setChanges((n) => n + 1);
        }
        seen.current ??= new Set();
        for (const a of alerts) seen.current.add(a.key);
      })
      .catch((e) => console.error("[approvals] inbox failed:", e));
  }, [announce]);

  useEffect(() => {
    if (signedIn) refresh();
    // The next person to sign in on this tab starts fresh.
    else seen.current = null;
  }, [signedIn, pathname, refresh]);

  useEffect(() => {
    if (!signedIn) return;
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [signedIn, refresh]);

  return (
    <ApprovalInboxContext.Provider value={{ waiting: signedIn ? waiting : 0, changes, refresh }}>
      {children}
    </ApprovalInboxContext.Provider>
  );
}
