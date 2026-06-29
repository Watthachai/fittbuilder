import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GEMINI_MODEL, type TokenUsage } from "@/lib/gemini";

/** Which AI endpoint produced the call (grouped in the admin report). */
export type UsageKind =
  | "generate"
  | "agent"
  | "detect_skill"
  | "design_options"
  | "detect_preset"
  | "extract_answers"
  | "code_suggestion"
  | "generate_skill"
  | "org_dna";

/**
 * Estimated Gemini pricing, USD per 1,000,000 tokens. These are ESTIMATES — update
 * to the real figures from https://ai.google.dev/pricing for your model. Cost in
 * the admin report is labelled "ประมาณการ".
 */
const PRICING: Record<string, { input: number; output: number }> = {
  // Paid tier, USD per 1M tokens (output includes thinking tokens).
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
};
const DEFAULT_PRICE = { input: 1.5, output: 9.0 };

/** Estimated USD cost for a token split, using the configured model's pricing. */
export function estimateCostUsd(promptTokens: number, outputTokens: number): number {
  const p = PRICING[GEMINI_MODEL] ?? DEFAULT_PRICE;
  return (promptTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/** The caller's user id from the session cookie, or null. */
export async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist one AI call's token usage (service-role insert — the table is RLS
 * deny-all; only this trusted server path and the admin report touch it). Never
 * throws: usage logging must not break an AI response. Call inside `after()`.
 */
export async function recordUsage(params: {
  userId: string | null;
  projectId: string | null;
  kind: UsageKind;
  usage: TokenUsage | null;
}): Promise<void> {
  if (!params.usage) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("fittbuilder_ai_usage").insert({
      user_id: params.userId,
      project_id: params.projectId,
      kind: params.kind,
      model: GEMINI_MODEL,
      prompt_tokens: params.usage.promptTokens,
      output_tokens: params.usage.outputTokens,
      total_tokens: params.usage.totalTokens,
    });
    if (error) console.error("[ai-usage] insert failed:", error.message);
  } catch (e) {
    console.error("[ai-usage] record failed:", e);
  }
}
