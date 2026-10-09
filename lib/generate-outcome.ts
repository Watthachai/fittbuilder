import type { TurnCut } from "@/lib/tasks";

/**
 * How a build turn (/api/generate) ended, as recorded in fittbuilder_ai_usage.
 * A cut turn kept what it wrote; a failed one produced nothing usable.
 */
export const GENERATE_OUTCOMES = ["done", "cut_time", "cut_tokens", "cut_error", "failed"] as const;
export type GenerateOutcome = (typeof GENERATE_OUTCOMES)[number];

export const GENERATE_OUTCOME_LABEL: Record<GenerateOutcome, string> = {
  done: "จบเอง",
  cut_time: "หมดเวลาของรอบ",
  cut_tokens: "ยาวเกินเพดาน",
  cut_error: "หลุดกลางทาง",
  failed: "ล้มเหลว",
};

/** One turn's end, written with its usage row. */
export interface RecordedTurn {
  outcome: GenerateOutcome;
  durationMs: number;
  /** The real error of a failed turn (the user only sees a generic one). */
  error: string | null;
}

export function outcomeOf(cut: TurnCut | null): GenerateOutcome {
  return cut ? `cut_${cut}` : "done";
}
