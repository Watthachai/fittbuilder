"use client";

import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import type { Json } from "@/lib/db/types";
import { parseDoc, type QuoteDoc } from "./quote";
import type { VersionKey } from "./versions";

/**
 * Load/save a quotation — one per (project, version).
 *
 * Not in `project.files`: every iteration turn ships the whole file map to the
 * model, so a quotation stored there would be read, rewritten and occasionally
 * "improved" by codegen. The numbers a customer signs against must be
 * untouchable by the thing that writes the app.
 *
 * Keyed by version too (migration 0042): Standard and Premium are different
 * tiers with different prices, and sharing one row let a Premium edit overwrite
 * the Standard figure.
 */

const TABLE = "fittbuilder_project_quotes";

/** @param today Seeds the issue date when a stored document has none. */
export async function loadQuote(
  projectId: string,
  version: VersionKey,
  today: string
): Promise<QuoteDoc | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload")
    .eq("project_id", projectId)
    .eq("version", version)
    .maybeSingle();
  if (error || !data) return null;
  return parseDoc(data.payload, today);
}

export async function saveQuote(
  projectId: string,
  version: VersionKey,
  doc: QuoteDoc
): Promise<void> {
  const supabase = createClient();
  const user = await currentUser();
  const { error } = await supabase.from(TABLE).upsert(
    { project_id: projectId, version, payload: doc as unknown as Json, updated_by: user?.id ?? null },
    { onConflict: "project_id,version" }
  );
  if (error) throw error;
}
