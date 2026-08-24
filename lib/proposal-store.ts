"use client";

import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import type { Json } from "@/lib/db/types";
import { parseProposal, type ProposalDoc } from "./proposal";

/**
 * Load/save the project's one proposal.
 *
 * Its own table for the same reason the quotation has one (0026, 0032): every
 * iteration turn ships the whole file map to the model, so a document stored in
 * `project.files` would be read, rewritten and occasionally "improved" by
 * codegen. What a customer is told the system does must be untouchable by the
 * thing that writes the system.
 */

const TABLE = "fittbuilder_project_proposals";

/** @param today Seeds the issue date when a stored document has none. */
export async function loadProposal(
  projectId: string,
  today: string
): Promise<ProposalDoc | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return parseProposal(data.payload, today);
}

export async function saveProposal(projectId: string, doc: ProposalDoc): Promise<void> {
  const supabase = createClient();
  const user = await currentUser();
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { project_id: projectId, payload: doc as unknown as Json, updated_by: user?.id ?? null },
      { onConflict: "project_id" }
    );
  if (error) throw error;
}
