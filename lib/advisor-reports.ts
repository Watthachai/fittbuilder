"use client";

import { createClient } from "@/lib/supabase/client";
import { normalizeAdvisorResult, type AdvisorResult } from "@/lib/org-advisor";
import { normalizeHealthResult, type HealthResult } from "@/lib/advisor-health";

/**
 * FITT Advisor report history (fittbuilder_advisor_reports, migration 0023).
 * Immutable per-run rows shared across the workspace — RLS gates every call to
 * org members, so this client is plain user-scoped reads.
 */

export type AdvisorReportKind = "pain_point" | "health_check";

export type AdvisorReport =
  | { id: string; kind: "pain_point"; result: AdvisorResult; createdBy: string | null; createdAt: string }
  | { id: string; kind: "health_check"; result: HealthResult; createdBy: string | null; createdAt: string };

/** The workspace's report history, newest first (invalid/stale rows dropped). */
export async function listAdvisorReports(orgId: string): Promise<AdvisorReport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_advisor_reports")
    .select("id, kind, result, created_by, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).flatMap((r): AdvisorReport[] => {
    const base = { id: r.id, createdBy: r.created_by, createdAt: r.created_at };
    if (r.kind === "pain_point") {
      const result = normalizeAdvisorResult(r.result as Partial<AdvisorResult>);
      return result ? [{ ...base, kind: "pain_point", result }] : [];
    }
    if (r.kind === "health_check") {
      const result = normalizeHealthResult(r.result as Partial<HealthResult>);
      return result ? [{ ...base, kind: "health_check", result }] : [];
    }
    return [];
  });
}

/** Delete one report (any member may clean up a bad run — RLS enforces). */
export async function deleteAdvisorReport(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fittbuilder_advisor_reports").delete().eq("id", id);
  if (error) throw error;
}

/** The glanceable headline number of a report (sentiment or overall health). */
export function reportScore(report: AdvisorReport): number | null {
  return report.kind === "pain_point"
    ? report.result.sentimentIndex
    : report.result.overallScore;
}
