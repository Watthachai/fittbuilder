"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/db/types";
import type { OrgDna, OrgRecord } from "@/lib/types";

// Analyses no longer live on the org row: FITT Advisor reports moved to their
// own history table (fittbuilder_advisor_reports, migration 0023). The old
// orgs.pain_radar column is dead data, backfilled into that table.
const SELECT = "id, owner_id, name, color, icon, org_dna, created_at, updated_at";

interface OrgRow {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  icon: string;
  org_dna: unknown;
  created_at: string;
  updated_at: string;
}

function rowToOrg(r: OrgRow): OrgRecord {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    dna: (r.org_dna && typeof r.org_dna === "object" ? r.org_dna : {}) as OrgDna,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Workspaces owned by the current user, oldest first (default workspace leads). */
export async function listOrgs(): Promise<OrgRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_orgs")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToOrg(r as OrgRow));
}

export async function getOrg(id: string): Promise<OrgRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_orgs")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[orgs] getOrg:", error);
    return null;
  }
  return data ? rowToOrg(data as OrgRow) : null;
}

export async function createOrg(
  name?: string,
  opts?: { color?: string; icon?: string }
): Promise<OrgRecord> {
  const supabase = createClient();
  // owner_id is stamped by the DB default (auth.uid()) to match the RLS check.
  const { data, error } = await supabase
    .from("fittbuilder_orgs")
    .insert({ name: name?.trim() || "พื้นที่ของฉัน", color: opts?.color, icon: opts?.icon })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message || "createOrg failed");
  return rowToOrg(data as OrgRow);
}

/** Update a workspace's identity (name/color/icon). Only provided fields change. */
export async function updateOrgMeta(
  id: string,
  patch: { name?: string; color?: string; icon?: string }
): Promise<void> {
  const supabase = createClient();
  const row: { name?: string; color?: string; icon?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) row.name = patch.name.trim() || "พื้นที่ของฉัน";
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.icon !== undefined) row.icon = patch.icon;
  const { error } = await supabase.from("fittbuilder_orgs").update(row).eq("id", id);
  if (error) throw error;
}

/** Persist the Org DNA profile (partial allowed — caller passes the full object). */
export async function updateOrgDna(id: string, dna: OrgDna): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_orgs")
    .update({ org_dna: dna as unknown as Json, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Delete a workspace. Its projects survive — org_id is set null (FK on delete). */
export async function deleteOrg(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fittbuilder_orgs").delete().eq("id", id);
  if (error) throw error;
}

/** The user's first workspace, or null if they have none (no auto-create — the
 *  user creates their own; there is no default workspace). */
export async function firstOrg(): Promise<OrgRecord | null> {
  const orgs = await listOrgs();
  return orgs[0] ?? null;
}

/** Fraction (0..1) of the Org DNA that's filled — for the completeness meter. */
export function dnaCompleteness(dna: OrgDna): number {
  const fields = [dna.decisionRights, dna.information, dna.motivators, dna.structure];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  return filled / fields.length;
}
