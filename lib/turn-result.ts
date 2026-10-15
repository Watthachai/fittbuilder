import { z } from "zod";
import type { TurnCut } from "@/lib/tasks";

/**
 * A build turn's answer as the server parks it in the project's draft when the
 * turn ends — what its `done` event said — so a studio that lost the stream can
 * still take it (lib/turn-reattach).
 */
export type TurnResult = {
  note: string;
  cut: TurnCut | null;
  deleted: string[];
};

const turnResultSchema = z.object({
  note: z.string(),
  cut: z.enum(["time", "tokens", "error"]).nullable(),
  deleted: z.array(z.string()),
});

/** The parked answer, or null while the turn runs. Throws on one it cannot read. */
export function parseTurnResult(raw: unknown): TurnResult | null {
  return raw === null ? null : turnResultSchema.parse(raw);
}
