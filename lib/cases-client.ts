"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import { storageName } from "@/lib/team-chat";
import type {
  CaseAlert,
  CaseAttachment,
  CaseContext,
  CaseDetail,
  CaseKind,
  CaseStatus,
  CaseSummary,
} from "@/lib/cases";

/** The browser side of cases: pictures go straight to storage, everything else through /api/cases. */

const BUCKET = "case-files";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CASE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `คำขอไม่สำเร็จ (${res.status})`);
  return data;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** Upload one picture into the signed-in person's own folder of the case bucket. */
export async function uploadCaseImage(file: File): Promise<CaseAttachment> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("แนบได้เฉพาะรูป PNG · JPG · WebP · GIF");
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} ใหญ่เกิน 5MB`);
  const user = await currentUser();
  if (!user) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  const path = `${user.id}/${crypto.randomUUID()}-${storageName(file.name)}`;
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name, type: file.type, size: file.size };
}

export function listCases(scope: "all" | "mine"): Promise<{ team: boolean; cases: CaseSummary[] }> {
  return call(`/api/cases?scope=${scope}`);
}

export function getCase(id: string): Promise<{ team: boolean; case: CaseDetail }> {
  return call(`/api/cases/${id}`);
}

export function createCase(input: {
  title: string;
  kind: CaseKind;
  body: string;
  projectId: string | null;
  context: CaseContext;
  attachments: CaseAttachment[];
}): Promise<{ id: string; number: number }> {
  return call("/api/cases", post(input));
}

export function replyToCase(
  id: string,
  input: { body: string; attachments: CaseAttachment[]; status: CaseStatus | null; fixedIn: string | null }
): Promise<{ ok: true }> {
  return call(`/api/cases/${id}`, post(input));
}

/** The cases waiting on the signed-in person, newest first (empty and signedIn=false when signed out). */
export function caseInbox(): Promise<{ signedIn: boolean; alerts: CaseAlert[] }> {
  return call("/api/cases/alerts");
}

/** The topic the database pings when a case changes (migration 0048). */
const CASES_TOPIC = "fittbuilder:cases";

// One subscription for the whole page, fanned out to every listener. supabase-js
// hands back the same channel for the same topic, so a listener that removed
// "its" channel on unmount (the cases overlay closing) used to cut off every
// other listener with it — the bell stopped hearing new answers.
const listeners = new Set<(caseId: string) => void>();
let live: { client: ReturnType<typeof createClient>; channel: RealtimeChannel } | null = null;

function listen(fn: (caseId: string) => void): () => void {
  listeners.add(fn);
  if (!live) {
    const client = createClient();
    const channel = client
      .channel(CASES_TOPIC)
      .on("broadcast", { event: "changed" }, ({ payload }) => {
        const { caseId } = payload as { caseId: string };
        for (const l of listeners) l(caseId);
      })
      .subscribe();
    live = { client, channel };
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && live) {
      void live.client.removeChannel(live.channel);
      live = null;
    }
  };
}

/**
 * Hear about every change to a case as it happens — a new case, a reply, a
 * status move — whether it came from the app or straight from the database.
 * The ping is only an id; refetch through /api/cases to see what changed.
 */
export function useCaseChanges(onChange: (caseId: string) => void, enabled = true): void {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;
    return listen((caseId) => latest.current(caseId));
  }, [enabled]);
}
