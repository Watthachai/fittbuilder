"use client";

import type { DnaTextKey } from "@/lib/org-dna";

export interface DnaCapture {
  block: DnaTextKey;
  snippet: string;
}

/** Ask the server whether a chat message reveals an Org DNA fact. Returns null on
 *  no-match or any failure — capture must never disrupt the chat. */
export async function captureDnaFromText(text: string): Promise<DnaCapture | null> {
  try {
    const res = await fetch("/api/dna-capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { block: DnaTextKey | null; snippet?: string };
    return data.block && data.snippet ? { block: data.block, snippet: data.snippet } : null;
  } catch {
    return null;
  }
}
