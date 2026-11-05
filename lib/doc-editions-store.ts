"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/db/types";
import type { ApprovalDocKind } from "./doc-approval";
import type { DocEdition } from "./doc-editions";
import type { VersionKey } from "./versions";

/** Keeping and listing a document's editions (migration 0069). */
const TABLE = "fittbuilder_doc_editions";
const COLUMNS = "id, number, label, payload, saved_by_name, saved_at";

type Row = {
  id: string;
  number: number;
  label: string;
  payload: Json;
  saved_by_name: string;
  saved_at: string;
};

const toEdition = (r: Row): DocEdition => ({
  id: r.id,
  number: r.number,
  label: r.label,
  payload: r.payload,
  savedByName: r.saved_by_name,
  savedAt: r.saved_at,
});

/** One document's editions, newest first. */
export async function listEditions(
  projectId: string,
  kind: ApprovalDocKind,
  version: VersionKey
): Promise<DocEdition[]> {
  const { data, error } = await createClient()
    .from(TABLE)
    .select(COLUMNS)
    .eq("project_id", projectId)
    .eq("doc_kind", kind)
    .eq("version", version)
    .order("number", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toEdition);
}

/** Keep the document as it is now. The database gives it its number. */
export async function saveEdition(
  projectId: string,
  kind: ApprovalDocKind,
  version: VersionKey,
  doc: object,
  label: string
): Promise<DocEdition> {
  const { data, error } = await createClient()
    .from(TABLE)
    .insert({ project_id: projectId, doc_kind: kind, version, label, payload: doc as unknown as Json })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toEdition(data);
}
