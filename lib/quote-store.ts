"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/db/types";
import { parseDoc, type QuoteDoc } from "./quote";

/**
 * Load/save the project's one quotation.
 *
 * Deliberately NOT in `project.files`: every iteration turn ships the whole
 * file map to the model, so a quotation stored there would be read, rewritten
 * and occasionally "improved" by codegen. The numbers a customer signs against
 * must be untouchable by the thing that writes the app.
 */

const TABLE = "fittbuilder_project_quotes";

/** @param today Seeds the issue date when a stored document has none. */
export async function loadQuote(projectId: string, today: string): Promise<QuoteDoc | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return parseDoc(data.payload, today);
}

export async function saveQuote(projectId: string, doc: QuoteDoc): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { project_id: projectId, payload: doc as unknown as Json, updated_by: auth.user?.id ?? null },
      { onConflict: "project_id" }
    );
  if (error) throw error;
}
