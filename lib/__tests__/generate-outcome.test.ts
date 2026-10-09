import { describe, expect, it } from "vitest";
import { outcomeOf } from "@/lib/generate-outcome";

describe("how a build turn ended", () => {
  it("is done when nothing cut it, and names the cut otherwise", () => {
    expect(outcomeOf(null)).toBe("done");
    expect(outcomeOf("time")).toBe("cut_time");
    expect(outcomeOf("tokens")).toBe("cut_tokens");
    expect(outcomeOf("error")).toBe("cut_error");
  });
});
