"use client";

import { createContext, useContext, useEffect } from "react";
import type { CaseAlert } from "@/lib/cases";

/**
 * What CaseInboxProvider shares with every page. Separate from the provider so
 * the cases view can read it without importing the provider that renders it.
 */
export interface Inbox {
  signedIn: boolean;
  alerts: CaseAlert[];
  /** Read again now — after opening a case, which marks it seen. */
  refresh: () => void;
  /** Open the cases over the current page (a case, or the list) — the page underneath stays as it is. */
  openCases: (caseId?: string) => void;
  /** The case whose thread is on screen right now, if any: its news needs no toast. */
  setViewing: (caseId: string | null) => void;
}

export const InboxContext = createContext<Inbox>({
  signedIn: false,
  alerts: [],
  refresh: () => {},
  openCases: () => {},
  setViewing: () => {},
});

export const useCaseInbox = (): Inbox => useContext(InboxContext);

/** Mark a case's thread as on screen while the calling component is mounted. */
export function useViewingCase(caseId: string): void {
  const { setViewing } = useCaseInbox();
  useEffect(() => {
    setViewing(caseId);
    return () => setViewing(null);
  }, [caseId, setViewing]);
}
